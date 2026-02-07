// ==Lampa==
// name: IPTV Lite
// version: 1.0.6
// description: IPTV плеер (исправлена ошибка Settings.add)
// author: Gemini
// ==/Lampa==

(function () {
    'use strict';

    function IPTVPlugin(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({mask: true, over: true});
        var items = $('<div class="category-full"></div>');
        var groups = {};

        this.create = function () {
            var _this = this;
            // Используем Lampa.Storage.get напрямую
            var url = Lampa.Storage.get('iptv_m3u_link', '');

            if (!url) {
                items.append('<div class="empty" style="text-align:center;padding:40px">Укажите ссылку на M3U в настройках (Раздел IPTV Lite)</div>');
            } else {
                Lampa.Loading.show();
                network.silent(url, function (str) {
                    _this.parse(str);
                    _this.renderGroups();
                    Lampa.Loading.hide();
                }, function () {
                    Lampa.Loading.hide();
                    Lampa.Noty.show('Не удалось загрузить плейлист');
                }, false, {dataType: 'text'});
            }

            scroll.append(items);
            return [scroll.render()];
        };

        this.parse = function (str) {
            groups = {'Все каналы': []};
            var lines = str.split('\n');
            var current = null;

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (line.indexOf('#EXTINF') === 0) {
                    current = {};
                    var name = line.match(/,(.*)$/);
                    var group = line.match(/group-title="([^"]+)"/);
                    current.name = name ? name[1].trim() : 'Без названия';
                    current.group = group ? group[1] : 'Разное';
                } else if (line.indexOf('http') === 0 && current) {
                    current.url = line;
                    if (!groups[current.group]) groups[current.group] = [];
                    groups[current.group].push(current);
                    groups['Все каналы'].push(current);
                    current = null;
                }
            }
        };

        this.renderGroups = function () {
            var _this = this;
            items.empty();
            Object.keys(groups).forEach(function (gName) {
                var card = Lampa.Template.get('button_category', {title: gName + ' (' + groups[gName].length + ')'});
                card.on('hover:enter', function () { _this.renderChannels(gName); });
                items.append(card);
            });
            Lampa.Controller.enable('content');
        };

        this.renderChannels = function (gName) {
            var _this = this;
            items.empty();
            var back = Lampa.Template.get('button_category', {title: '[ Назад ]'});
            back.on('hover:enter', function () { _this.renderGroups(); });
            items.append(back);

            groups[gName].forEach(function (chan) {
                var card = Lampa.Template.get('button_category', {title: chan.name});
                card.on('hover:enter', function () {
                    Lampa.Player.play({ url: chan.url, title: chan.name });
                    Lampa.Player.playlist([{ url: chan.url, title: chan.name }]);
                });
                items.append(card);
            });
            Lampa.Controller.enable('content');
        };

        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () {
            network.clear();
            scroll.destroy();
            items.remove();
        };
    }

    function startPlugin() {
        // Регистрация компонента
        Lampa.Component.add('iptv_lite', IPTVPlugin);

        // Добавляем пункт в меню
        Lampa.Menu.add({
            id: 'iptv_lite',
            title: 'IPTV Lite',
            icon: '<svg height="36" viewBox="0 0 24 24" width="36" xmlns="http://www.w3.org/2000/svg"><path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="white"/></svg>',
            section: 'main',
            onSelect: function() {
                Lampa.Activity.push({ title: 'IPTV Lite', component: 'iptv_lite', page: 1 });
            }
        });

        // ПРАВИЛЬНАЯ регистрация настроек через Params
        Lampa.Params.select('iptv_m3u_link', '', 'M3U Link'); // Резервируем имя переменной
        
        // Создаем секцию в настройках
        Lampa.Template.add('settings_iptv_lite', '<div><div class="settings-param selector" data-name="iptv_m3u_link" data-type="input"><div class="settings-param__name">M3U Плейлист URL</div><div class="settings-param__value"></div><div class="settings-param__descr">Введите ссылку на .m3u файл</div></div></div>');

        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name === 'main') {
                var item = $('<div class="settings-folder selector" data-component="iptv_lite_settings"><div class="settings-folder__icon"><svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" fill="white"/></svg></div><div class="settings-folder__name">IPTV Lite</div></div>');
                item.on('hover:enter', function () {
                    Lampa.Settings.create('iptv_lite_settings', 'IPTV Lite');
                    Lampa.Settings.add(Lampa.Template.get('settings_iptv_lite', {}));
                    Lampa.Controller.enable('settings_iptv_lite');
                });
                e.body.find('.settings-main').append(item);
            }
        });
    }

    if (window.Lampa) {
        Lampa.Extensions.add({
            id: 'iptv_lite',
            type: 'plugin',
            onInit: function () {
                if (window.app_ready) startPlugin();
                else {
                    Lampa.Listener.follow('app', function (e) {
                        if (e.type == 'ready') startPlugin();
                    });
                }
            }
        });
    }
})();
