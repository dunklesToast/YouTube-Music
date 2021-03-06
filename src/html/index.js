/**
 * Created by nilsbergmann on 03.02.17.
 */
const SocketEvents = require('./HTMLSocketEvents');
const {ipcRenderer} = require('electron');
const app = require('electron').remote.app;
const {Socket} = require('electron-ipc-socket');
const log = require('../Logger')(true);
const YTLib = require('../YTLib');
const getYouTubeID = require('get-youtube-id');
const path = require('path');
const Query = require('./Query');
const percentage = require('percentage-calc');
const async = require('async');
const Vibrant = require('node-vibrant');


const an = angular.module('YouTubePlayer', ['ngMaterial', 'ui.router', 'ui.router.title']);
an.controller('MainController', ($scope, $mdDialog, $mdSidenav, $state, $rootScope) => {
    $scope.safeApply = function (fn) {
        const phase = this.$root.$$phase;
        if (phase == '$apply' || phase == '$digest') {
            if (fn && (typeof(fn) === 'function')) {
                fn();
            }
        } else {
            this.$apply(fn);
        }
    };

    log.info("Loading MainController");
    const socket = Socket('main', ipcRenderer);
    socket.open();
    SocketEvents({$scope: $scope, socket: socket, $mdDialog: $mdDialog, $rootScope: $rootScope});

    $scope.toggleSideNav = function () {
        $mdSidenav('SideNav').toggle();
    };

    $scope.state = $state;

    $scope.PlayerToolbar = `max-height: 20%;`;
    $scope.ToolbarColors = ``;
    $scope.PlayerButtonColors = "";
    $scope.ContentStyle = "height: 100%";
    $rootScope.TestT = "X";

    $rootScope.$on('showonly', (ev, showonly) => {
        $scope.showonly = showonly;
        $scope.DoQuery(document.getElementById('SearchField').value);
    });

    $scope.VideoPlayer = document.getElementById('HTMLVideoPlayer');

    $scope.VideoPlayer.onplay = () => {
        $rootScope.$emit('VideoPlayerIsNowPlaying');
    };

    $rootScope.$on('VideoInformationLoaded', () => {
        console.log(`Thumbnail: ${$scope.CurrentThumbnail}`);
        Vibrant.from($scope.CurrentThumbnail).getPalette((error, Palette) => {
            if (!error){
                console.log(Palette);
                $scope.PlayerToolbar = `max-height: 20%; background-color: ${Palette.Vibrant.getHex()}!important; color: ${Palette.Vibrant.getBodyTextColor()}!important;`;
                $scope.PlayerButtonColors = `color: ${Palette.Vibrant.getBodyTextColor()}!important;`;
                $scope.ContentStyle = `height: 100%; background-color: ${Palette.Vibrant.getHex()};`;
                $scope.ToolbarColors = `background-color: ${Palette.Muted.getHex()}!important; color: ${Palette.Muted.getBodyTextColor()}!important;`;
                $rootScope.$emit('ApplyColors', $scope.PlayerToolbar, $scope.PlayerButtonColors, $scope.ContentStyle);
                $scope.safeApply();
            } else {
                console.error(error);
            }
        });

    });

    $scope.CurrentVideoId = "";
    $scope.CurrentVideoSrc = "";
    $scope.CurrentVideoInfo = null;

    $scope.AllDownloads = [];

    setInterval(function () {
        if ($scope.VideoPlayer.duration) {
            //$scope.PrettyDuration = extround($scope.VideoPlayer.duration / 60, 100).toString().replace('.', ':');
            $scope.PrettyDuration = Math.floor($scope.VideoPlayer.duration / 60) + ":" + Math.round($scope.VideoPlayer.duration % 60);
        } else {
            $scope.PrettyDuration = "0:00"
        }
        if ($scope.CurrentVideoInfo && $scope.CurrentVideoInfo.snippet && $scope.CurrentVideoInfo.snippet.thumbnails && $scope.CurrentVideoInfo.snippet.thumbnails.maxres){
            if ($scope.CurrentVideoInfo.snippet.thumbnails.maxres.Path){
                $scope.CurrentThumbnail = $scope.CurrentVideoInfo.snippet.thumbnails.maxres.Path;
            } else {
                $scope.CurrentThumbnail = $scope.CurrentVideoInfo.snippet.thumbnails.maxres.url;
            }
        }
        $rootScope.$emit('UpdatePlayerData', {
            currentTime: $scope.VideoPlayer.currentTime,
            playing: ($scope.VideoPlayer.paused == false),
            buffered: $scope.VideoPlayer.buffered,
            duration: $scope.VideoPlayer.duration,
            ended: $scope.VideoPlayer.ended,
            volume: $scope.VideoPlayer.volume,
            CurrentVideoId: $scope.CurrentVideoId,
            CurrentVideoSrc: $scope.CurrentVideoSrc,
            CurrentVideoInfo: $scope.CurrentVideoInfo,
            PrettyDuration: $scope.PrettyDuration,
            percent: percentage.from($scope.VideoPlayer.currentTime, $scope.VideoPlayer.duration),
            BufferPercent: $scope.CurrentBuffered,
            CurrentPLPosition: $scope.CurrentPLPosition,
            CurrentPL: $scope.CurrentPL,
            muted: $scope.VideoPlayer.muted,
            Thumbnail: $scope.CurrentThumbnail,
            PlayerToolbar: $scope.PlayerToolbar,
            PlayerButtonColors: $scope.PlayerButtonColors,
            ContentStyle: $scope.ContentStyle
        });
        if ($scope.VideoPlayer.ended && $scope.CurrentPLPosition != null){
            log.info('Song finished. Got to the next one.');
            //$rootScope.$emit('Play playlist', $scope.CurrentPL._id, $scope.CurrentPLPosition + 1);
            if ($scope.CurrentPL.items.length - 1 > $scope.CurrentPLPosition){
                $rootScope.$emit('Play', $scope.CurrentPL.items[$scope.CurrentPLPosition + 1].snippet.resourceId.videoId, $scope.CurrentPL.items[$scope.CurrentPLPosition + 1].snippet.position);
            } else {
                $rootScope.$emit('Play', $scope.CurrentPL.items[0].snippet.resourceId.videoId, $scope.CurrentPL.items[0].snippet.position);
            }
        }
    }, 100);

    $scope.VideoPlayer.onloadstart = () => {
        socket.send('get video informations', {videoId: $scope.CurrentVideoId}, (error, data) => {
            console.log(data);
            if (data.error) throw data.error;
            if (!data.error) {
                $scope.CurrentVideoInfo = data;
                if (!$scope.CurrentVideoInfo.snippet.thumbnails.maxres){
                    if ($scope.CurrentVideoInfo.snippet.thumbnails.high){
                        $scope.CurrentVideoInfo.snippet.thumbnails.maxres = $scope.CurrentVideoInfo.snippet.thumbnails.high;
                    } else if ($scope.CurrentVideoInfo.snippet.thumbnails.medium) {
                        $scope.CurrentVideoInfo.snippet.thumbnails.maxres = $scope.CurrentVideoInfo.snippet.thumbnails.medium;
                    } else {
                        $scope.CurrentVideoInfo.snippet.thumbnails.maxres = $scope.CurrentVideoInfo.snippet.thumbnails.default;
                    }
                }
            }
            if ($scope.CurrentVideoInfo && $scope.CurrentVideoInfo.snippet && $scope.CurrentVideoInfo.snippet.thumbnails && $scope.CurrentVideoInfo.snippet.thumbnails.maxres){
                if ($scope.CurrentVideoInfo.snippet.thumbnails.maxres.Path){
                    $scope.CurrentThumbnail = $scope.CurrentVideoInfo.snippet.thumbnails.maxres.Path;
                } else {
                    $scope.CurrentThumbnail = $scope.CurrentVideoInfo.snippet.thumbnails.maxres.url;
                }
            }
            $rootScope.$emit('VideoInformationLoaded');
        });
    };

    $rootScope.$on('Trigger mute', () => {
        $scope.VideoPlayer.muted = !$scope.VideoPlayer.muted;
    });

    $rootScope.$on('Skip current song', () => {
        if ($scope.CurrentPLPosition != null){
            log.info("Skip song");
            // $rootScope.$emit('Play playlist', $scope.CurrentPL._id, $scope.CurrentPLPosition + 1);
            if ($scope.CurrentPL.items.length - 1 > $scope.CurrentPLPosition){
                $rootScope.$emit('Play', $scope.CurrentPL.items[$scope.CurrentPLPosition + 1].snippet.resourceId.videoId, $scope.CurrentPL.items[$scope.CurrentPLPosition + 1].snippet.position);
            } else {
                $rootScope.$emit('Play', $scope.CurrentPL.items[0].snippet.resourceId.videoId, $scope.CurrentPL.items[0].snippet.position);
            }
        }
    });

    $rootScope.$on('set volume', (ev, volume) => {
        $scope.VideoPlayer.volume = volume;
    });

    $rootScope.$on('Last song in pl', () => {
        if ($scope.CurrentPLPosition != null){
            log.info("Go back in playlist");
            // $rootScope.$emit('Play playlist', $scope.CurrentPL._id, $scope.CurrentPLPosition - 1);
            if ($scope.CurrentPLPosition > 0){
                $rootScope.$emit('Play', $scope.CurrentPL.items[$scope.CurrentPLPosition - 1].snippet.resourceId.videoId, $scope.CurrentPL.items[$scope.CurrentPLPosition - 1].snippet.position);
            }
        }
    });

    $scope.CurrentVideoInfo = {};
    $scope.CurrentVideoInfo.snippet = {};
    $scope.CurrentVideoInfo.snippet.thumbnails = {};
    $scope.CurrentVideoInfo.snippet.thumbnails.maxres = {};
    $scope.CurrentVideoInfo.snippet.thumbnails.maxres.url = "white.gif";

    $scope.VideoPlayer.addEventListener('progress', function () {
        const bufferedEnd = $scope.VideoPlayer.buffered.end($scope.VideoPlayer.buffered.length - 1);
        const duration = $scope.VideoPlayer.duration;
        if (duration > 0) {
            $scope.CurrentBuffered = ((bufferedEnd / duration) * 100);
        }
    });

    $rootScope.$on('Set position', (ev, position) => {
        $scope.VideoPlayer.currentTime = position;
    });

    $rootScope.$on('Play', (ev, videoid, plPosition) => {
        $scope.CurrentVideoSrc = "http://localhost:2458/" + videoid;
        $scope.CurrentVideoId = videoid;
        $scope.CurrentTime = $scope.VideoPlayer.currentTime;
        if (plPosition != null) {
            $scope.CurrentPLPosition = plPosition;
        } else {
            $scope.CurrentPLPosition = null;
            $scope.CurrentPL = null;
            log.info("Remove playlist");
        }
        log.info(`Playlist position: `, plPosition);
        $scope.safeApply(() => {
            $scope.VideoPlayer.load();
            $scope.VideoPlayer.play();
            $rootScope.$emit('!block buttons because loading');
        });
    });

    $rootScope.$on('Play playlist', (ev, playlistid, songAt) => {
        $rootScope.$emit('block buttons because loading');
        socket.send('get playlist informations', {playlistId: playlistid}, (error, data) => {
            if (error) throw error;
            if (data) {
                if (data.items.length > 0){
                    let startIndex;
                    for (let ItemIndex in data.items) {
                        if (!data.items.hasOwnProperty(ItemIndex)) continue;
                        if (data.items[ItemIndex].snippet.position == songAt?songAt:0) {
                            startIndex = ItemIndex;
                            break;
                        }
                    }
                    if (!startIndex) {
                        log.info("No position, set to 0", startIndex);
                        startIndex = 0;
                    }
                    $scope.CurrentPL = data;
                    console.log("xxxxxx: " , data.items[startIndex]);
                    log.info(typeof data.items[startIndex].snippet.position);
                    $rootScope.$emit('Play', data.items[startIndex].snippet.resourceId.videoId, data.items[startIndex].snippet.position);
                }
            }
        });
    });

    $rootScope.$on('Trigger player', () => {
        if ($scope.VideoPlayer.paused) {
            $scope.VideoPlayer.play();
        } else {
            $scope.VideoPlayer.pause();
        }
    });

    $scope.PlayTest = function () {
        $rootScope.$emit('Play', '9YvQHlcTM24');
    };

    $scope.QueryResults = [];

    $scope.PlayProgress = 0;
    $scope.PlayIcon = "play_circle_outline";

    $scope.socket = socket;

    $scope.UpdateShowOnly = function (ShowOnly) {
        $scope.ShowOnly = ShowOnly;
        $scope.safeApply();
    };

    $scope.$watch('state.current.name', () => {
        //$scope.search = ($scope.state.current.name == "library" || $scope.state.current.name == "search-youtube" );
        switch ($scope.state.current.name) {
            case "search-youtube":
                $scope.DoQuery = function (textquery) {
                    Query.SearchOnYouTube(textquery, null, $scope.showonly, $scope, socket);
                    $scope.safeApply();
                };
                break;
            case "player":
                setTimeout(() => {
                    $scope.pla = "PLwUHjHYlA7ucdqxZM5Uyr6NZn7mzhTf4r";
                    $scope.safeApply();
                }, 1000);
                break;
            case "download":
                $scope.filterDownloaded(null);
                break;
            default:
                $scope.DoQuery = function () {
                    $scope.QueryResults = [];
                };
                break;
        }
        $scope.safeApply();
    });

    $scope.downloadTest = function () {
        log.info({kind: "youtube#video", videoId: "9YvQHlcTM24"});
        socket.send('Start download of', {kind: "youtube#video", videoId: "9YvQHlcTM24"});
    };

    $scope.downloadVideo = function (videoId) {
        socket.send('Start download of', {kind: "youtube#video", videoId: videoId});
    };

    $scope.downloadPlaylist = function (playlistId) {
        socket.send('Start download of', {kind: "youtube#playlist", playlistId: playlistId});
    };

    $scope.downloadTestPL = function () {
        log.info({kind: "youtube#playlist", playlistId: "PLwUHjHYlA7ucdqxZM5Uyr6NZn7mzhTf4r"});
        socket.send('Start download of', {kind: "youtube#playlist", playlistId: "PLwUHjHYlA7ucdqxZM5Uyr6NZn7mzhTf4r"});
    };

    $scope.filterDownloaded = function (Query) {
        $scope.AllDownloadedQuery = Query;
        return new Promise((resolve, reject) => {
            $scope.socket.send('get all downloaded songs', (error, data) => {
                if (error) {
                    reject(error);
                } else {
                    if (Query){
                        let FilteredDownloads = [];
                        async.each(data, (CData, ECallback) => {
                            if (CData.snippet.title.toLowerCase().includes(Query.toLowerCase()) || CData.snippet.channelTitle.toLowerCase().includes(Query.toLowerCase())){
                                FilteredDownloads.push(CData);
                            }
                            ECallback();
                        }, () => {
                            $scope.AllDownloaded = FilteredDownloads;
                            $scope.safeApply(() => {
                                resolve(FilteredDownloads);
                            });
                        });
                    } else {
                        $scope.AllDownloaded = data;
                        $scope.safeApply(() => {
                            resolve(data);
                        });
                    }
                }
            });
        });
    };

    $scope.reDownload = function (index) {
        $scope.AllDownloaded[index].redo = true;
        $scope.safeApply(() => {
            $scope.socket.send('re-download with id', {kind: "youtube#video", videoId: $scope.AllDownloaded[index]._id}, (e, error) => {
                log.info(`${$scope.AllDownloaded[index]._id} added again to queue.`, error);
            });
        });
    };

    $scope.removeDownload = function (index) {
        $scope.AllDownloaded[index].redo = true;
        $scope.safeApply(() => {
            $scope.socket.send('remove download', {videoId: $scope.AllDownloaded[index]._id}, () => {
                log.info(`Removed ${$scope.AllDownloaded[index]._id}`);
                $scope.filterDownloaded($scope.AllDownloadedQuery);
            });
        });
    }

});

an.config(function ($stateProvider, $urlRouterProvider, $mdThemingProvider) {
    $mdThemingProvider.theme('YouTube').primaryPalette('red').accentPalette('blue-grey');

    $mdThemingProvider.theme('Inputs').primaryPalette('grey');

    $mdThemingProvider.setDefaultTheme('YouTube');

    $urlRouterProvider.otherwise('/home');

    $stateProvider
        .state('home', {
            url: '/home',
            resolve: {
                $title: function () {
                    return "Home";
                }
            }
        })
        .state('library', {
            url: '/library',
            templateUrl: 'pages/Library.html',
            resolve: {
                $title: function () {
                    return "My Library"
                }
            },
            controller: function ($scope, $rootScope, $mdDialog) {
                $scope.socket.send('get all playlists', (error, playlists) => {
                    $scope.LibraryPlaylists = playlists;
                    $scope.socket.send('get all songs', (error, videos) => {
                        $scope.LibraryVideos = videos;
                        console.log(`Videos: `, videos);
                        console.log(`Playlists: `, playlists);
                    });
                });
                $scope.play = function (index, where) {
                    if (where[index].id.kind == "youtube#playlist"){
                        $rootScope.$emit('Play playlist', where[index].id.playlistId, 0);
                    } else {
                        $rootScope.$emit('Play', where[index].id.videoId);
                    }
                };
                $scope.GoToInPl = function (XIndex) {
                    $scope.LibraryViewPlaylist = $scope.LibraryPlaylists[XIndex];
                    console.log(`Open Playlist: `, $scope.LibraryViewPlaylist);
                    $scope.safeApply();
                    $mdDialog.show({
                        fullscreen: true,
                        scope: $scope,
                        preserveScope: true,
                        controller: function ($scope, $mdDialog, $rootScope) {
                            $scope.safeApply();
                            $scope.cancel = function () {
                                $mdDialog.hide();
                            };
                            $scope.xplay = function (index) {
                                $rootScope.$emit('Play playlist', $scope.LibraryViewPlaylist.id.playlistId, $scope.LibraryViewPlaylist.items[index].snippet.position);
                                $mdDialog.hide();
                            };
                        },
                        templateUrl: 'dialogs/GoToDialogLibrary.html'
                    });
                };
            }
        })
        .state('library.playlist', {
            url: '/library/:playlistId',
            templateUrl: 'pages/Library.Playlist.html',
            controller: function ($scope, $stateParams) {
                $scope.ViewPlaylistId = $stateParams.playlistId;
            }
        })
        .state('download', {
            url: '/download',
            templateUrl: 'pages/Download.html'
        })
        .state('search-youtube', {
            url: '/search/youtube',
            templateUrl: 'pages/Search-YouTube.html',
            controller: function ($scope, $rootScope, $mdDialog) {
                // $scope.$watch('showonly', () => {
                //     $rootScope.$emit('showonly', $scope.showonly);
                // });
                $scope.showonly = "";
                $scope.showDetails = function (index) {
                    $scope.Details = {};
                    $scope.Details.title = $scope.QueryResults[index].snippet.title;
                    $scope.Details.description = $scope.QueryResults[index].snippet.description;
                    $scope.Details.thumbnail = $scope.QueryResults[index].snippet.thumbnails.high.url;
                    $scope.Details.kind = JSON.parse(JSON.stringify($scope.QueryResults[index].id.kind.toString()));
                    console.log($scope.Details.kind);
                    if ($scope.QueryResults[index].id.videoId) JSON.parse(JSON.stringify($scope.Details.videoId = $scope.QueryResults[index].id.videoId.toString()));
                    $mdDialog.show({
                        templateUrl: 'dialogs/ShowDetails.html',
                        clickOutsideToClose: true,
                        escapeToClose: true,
                        scope: $scope,
                        preserveScope: true,
                        fullscreen: true,
                        controller: ($scope) => {
                            $scope.safeApply();
                            console.log(`DD: ${$scope.Details.kind}`)
                        }
                    });
                };

                $scope.play = function (index) {
                    if ($scope.QueryResults[index].id.kind == "youtube#playlist"){
                        $rootScope.$emit('Play playlist', $scope.QueryResults[index].id.playlistId, 0);
                    } else {
                        $rootScope.$emit('Play', $scope.QueryResults[index].id.videoId);
                    }

                };

                $scope.DoQuery = function (textquery) {
                    Query.SearchOnYouTube(textquery, null, $scope.showonly, $scope, socket);
                    $scope.safeApply();
                };

                $scope.SearchOnYT = function (QQuery) {
                    return new Promise((resolve, reject) => {
                        if ($scope.SOYTPromise){
                            if ($scope.SOYTPromise.isPending()){
                                $scope.SOYTPromise.cancel();
                            }
                        }
                        $scope.SOYTPromise = Query.Query(QQuery, null, $scope.showonly, $scope.socket).then((Result) => {
                            $scope.QueryResults = Result;
                            $scope.safeApply();
                            resolve(Result);
                        }).catch((e) => {
                            log.error(e);
                            reject(e);
                        });
                    });
                };
                $scope.AddOrRemove = function (Data, index) {
                    console.log($scope.QueryResults[index]);
                    if ($scope.QueryResults[index].add_button == "add") {
                        $scope.QueryResults[index].checked = false;
                        $scope.safeApply();
                        log.info(Data);
                        $scope.socket.send('add to library', Data, (error) => {
                            if (error) throw error;
                            if (!error) {
                                $scope.QueryResults[index].add_button = "remove_circle";
                                $scope.QueryResults[index].checked = true;
                                $scope.safeApply();
                            }
                        });
                    } else {
                        $scope.QueryResults[index].checked = false;
                        $scope.safeApply();
                        $scope.socket.send('remove from library', Data, (error) => {
                            if (error) throw error;
                            if (!error) {
                                $scope.QueryResults[index].add_button = "add";
                                $scope.QueryResults[index].checked = true;
                                $scope.safeApply();
                            }
                        });
                    }
                };
            },
            resolve: {
                $title: function () {
                    return "Find Playlist & Tracks on YouTube"
                }
            }
        })
        .state('player', {
            url: '/player',
            templateUrl: 'pages/Player.html',
            resolve: {
                $title: function () {
                    return "Player"
                }
            }
        });
});

function extround(zahl, n_stelle) {
    zahl = (Math.round(zahl * n_stelle) / n_stelle);
    return zahl;
}