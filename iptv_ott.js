// ==Lampa==
// name: Lampa IPTV Lite
// version: 1.0.1
// description: IPTV плеер для Lampa с поддержкой M3U и EPG
// author: Gemini Developer
// ==/Lampa==

(function () {
    'use strict';

    function IPTVPlugin() {
        var playlistData = [];
        var groups = {};

        this.init = function () {
            console.log('IPTV Plugin: Start initialization');

            // Регистрация компонента экрана
            Lampa.Component.add('iptv_lite', this.render.bind(this));

            // Добавление в настройки
            Lampa.Settings.add({
                title: 'IPTV Lite',
                type: 'button',
                icon: '<svg height="36" viewBox="0 0 24 24" width="36" xmlns="http://www.w3.org/2000/svg"><path d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM5 7V5h14v2zm14 12H5a2 2 0 0 0-2 2v2h18v-2a2 2 0 0 0-2-2zm0 2H5v-2h14zm-9-5h4a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2zm0-5h4v3h-4z" fill="white"/></svg>',
                onContext: function () {
                    Lampa.Activity.push({
                        url: '',
                        title: 'IPTV Lite',
                        component: 'iptv_lite',
                        page: 1
                    });
                }
            });

            // Параметры в настройках
            Lampa.Settings.main && Lampa.Settings.main({
                id: 'iptv_lite_settings',
                title: 'IPTV Lite Настройки',
                icon: '<svg height="36" viewBox="0 0 24 24" width="36" xmlns="http://www.w3.org/2000/svg"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65z" fill="white"/></svg>'
            });

            Lampa.Settings.add({
                name: 'iptv_m3u_link',
                section: 'iptv_lite_settings',
                title: 'M3U Плейлист URL',
                type: 'input',
                placeholder: 'http://server.com/playlist.m3u',
                default: ''
            });

            Lampa.Settings.add({
                name: 'iptv_epg_link',
                section: 'iptv_lite_settings',
                title: 'XMLTV EPG URL',
                type: 'input',
                placeholder: 'http://server.com/epg.xml.gz',
                default: ''
            });
        };

        this.render = function (object) {
            var scroll = new Lampa.Scroll({mask: true, over: true});
            var items_container = $('<div class="category-full"></div>');
            var m3u_url = Lampa.Storage.get('iptv_m3u_link', '');
            var epg_url = Lampa.Storage.get('iptv_epg_link', '');

            this.create = function () {
                var _this = this;
                if (!m3u_url) {
                    items_container.append('<div class="empty" style="text-align:center;padding:20px;">Укажите ссылку на M3U в настройках (IPTV Lite)</div>');
                } else {
                    this.load(m3u_url);
                }
                scroll.append(items_container);
                return [scroll.render()];
            };

            this.load = function (url) {
                var _this = this;
                Lampa.Loading.show();
                $.ajax({
                    url: url,
                    method: 'GET',
                    success: function (str) {
                        _this.parse(str);
                        _this.showGroups();
                        Lampa.Loading.hide();
                    },
                    error: function () {
                        Lampa.Loading.hide();
                        Lampa.Noty.show('Ошибка загрузки плейлиста. Проверьте CORS или ссылку.');
                    }
                });
            };

            this.parse = function (str) {
                playlistData = [];
                groups = {'Все каналы': []};
                var lines = str.split('\n');
                var currentItem = null;

                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i].trim();
                    if (line.indexOf('#EXTINF') === 0) {
                        currentItem = {};
                        var nameMatch = line.match(/,(.*)$/);
                        var groupMatch = line.match(/group-title="([^"]+)"/);
                        var logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        var idMatch = line.match(/tvg-id="([^"]+)"/);

                        currentItem.name = nameMatch ? nameMatch[1].trim() : 'Без названия';
                        currentItem.group = groupMatch ? groupMatch[1] : 'Разное';
                        currentItem.logo = logoMatch ? logoMatch[1] : '';
                        currentItem.epg_id = idMatch ? idMatch[1] : '';
                    } else if (line.indexOf('http') === 0 && currentItem) {
                        currentItem.url = line;
                        playlistData.push(currentItem);
                        if (!groups[currentItem.group]) groups[currentItem.group] = [];
                        groups[currentItem.group].push(currentItem);
                        groups['Все каналы'].push(currentItem);
                        currentItem = null;
                    }
                }
            };

            this.showGroups = function () {
                var _this = this;
                items_container.empty();
                
                Object.keys(groups).forEach(function (gName) {
                    var item = Lampa.Template.get('button_category', {title: gName + ' (' + groups[gName].length + ')'});
                    item.on('hover:enter', function () {
                        _this.showChannels(gName);
                    });
                    items_container.append(item);
                });
                Lampa.Controller.enable('content');
            };

            this.showChannels = function (gName) {
                var _this = this;
                items_container.empty();
                
                var back = Lampa.Template.get('button_category', {title: ' [ Назад к группам ] '});
                back.on('hover:enter', function () { _this.showGroups(); });
                items_container.append(back);

                groups[gName].forEach(function (chan) {
                    var item = Lampa.Template.get('button_category', {title: chan.name});
                    item.on('hover:enter', function () {
                        var video = {
                            url: chan.url,
                            title: chan.name,
                            img: chan.logo
                        };
                        
                        Lampa.Player.play(video);
                        Lampa.Player.playlist([video]);
                    });
                    items_container.append(item);
                });
                Lampa.Controller.enable('content');
            };

            this.pause = function () {};
            this.stop = function () {};
            this.destroy = function () {
                items_container.remove();
                scroll.destroy();
            };
        };
    }

    // Регистрация расширения в Lampa
    if (window.Lampa) {
        Lampa.Extensions.add({
            id: 'iptv_lite',
            type: 'plugin',
            onInit: function () {
                var plugin = new IPTVPlugin();
                // Используем Listener для ожидания полной готовности
                Lampa.Listener.follow('app', function (e) {
                    if (e.type === 'ready') {
                        plugin.init();
                    }
                }, true);
            }
        });
    }
})();
