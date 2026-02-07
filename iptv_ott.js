// ==Lampa==
// name: IPTV TiviMate Pro
// version: 1.4.8
// description: Дизайн TiviMate, чтение EPG из плейлиста и фикс лого
// author: Gemini
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent(object) {
        var _this = this;
        var items = $('<div class="tivimate-container selector"></div>');
        var groups = {};
        var favorites = Lampa.Storage.get('iptv_fav_list', []);
        var epg_url = "";

        if (!$('#tivimate-style-final').length) {
            $('head').append('<style id="tivimate-style-final">' +
                '.tivimate-container { width:100%; height: 100%; overflow-y: auto; background: #0f1216; box-sizing: border-box; padding: 20px; }' +
                '.tv-grid-final { display: flex; flex-direction: column; padding-bottom: 80px; }' +
                '.tv-row-final { display: flex; align-items: center; padding: 12px 18px; background: rgba(255,255,255,0.03); margin-bottom: 6px; border-radius: 6px; border-left: 4px solid transparent; cursor: pointer; }' +
                '.tv-row-final.focus { background: rgba(52, 152, 219, 0.2) !important; border-left-color: #3498db; }' +
                '.tv-logo-final { width: 55px; height: 35px; background: #000; border-radius: 4px; margin-right: 18px; flex-shrink: 0; position: relative; overflow: hidden; }' +
                '.tv-logo-final img { width: 100%; height: 100%; object-fit: contain; }' +
                '.tv-info-final { flex: 1; overflow: hidden; }' +
                '.tv-name-final { font-size: 1.2em; color: #fff; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }' +
                '.tv-epg-final { font-size: 0.85em; color: #3498db; margin-top: 3px; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
                '.tv-header-final { font-size: 0.8em; color: rgba(255,255,255,0.3); text-transform: uppercase; margin: 25px 0 10px 5px; letter-spacing: 1.5px; }' +
                '/* Очистка интерфейса */' +
                '.activity__footer, .pwa-install, .layer--footer { display: none !important; }' +
                '</style>');
        }

        // Умный прокси для ресурсов
        function getSmartUrl(url) {
            if (!url) return '';
            if (url.indexOf('http://') === 0 && window.location.protocol === 'https:') {
                return 'https://corsproxy.io/?' + encodeURIComponent(url);
            }
            return url;
        }

        this.create = function () {
            var url = Lampa.Storage.get('iptv_m3u_link', '');
            if (!url) this.renderSettings();
            else this.load(url);
        };

        this.load = function(url) {
            items.html('<div style="color:#fff; text-align:center; padding:50px; opacity:0.5;">Загрузка TiviMate...</div>');
            $.ajax({
                url: getSmartUrl(url),
                method: 'GET',
                success: function(str) { _this.parse(str); _this.renderMain(); },
                error: function() { Lampa.Noty.show('Ошибка: Проверьте ссылку плейлиста'); _this.renderSettings(); }
            });
        };

        this.parse = function (str) {
            groups = {'Все каналы': []};
            var lines = str.split('\n');
            var cur = null;
            
            // Ищем EPG в заголовке
            var epg_match = str.match(/url-tvg="([^"]+)"/i);
            if (epg_match) {
                epg_url = epg_match[1];
                if (window.Lampa && Lampa.TV) Lampa.TV.addSource('playlist_epg', epg_url);
            }

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (line.indexOf('#EXTINF') === 0) {
                    cur = {
                        name: line.match(/,(.*)$/)?.[1].trim() || 'Без названия',
                        logo: line.match(/(?:tvg-logo|logo|url-tvg)="([^"]+)"/i)?.[1] || '',
                        group: line.match(/group-title="([^"]+)"/i)?.[1] || 'Разное'
                    };
                } else if (line.indexOf('http') === 0 && cur) {
                    cur.url = line;
                    if (!groups[cur.group]) groups[cur.group] = [];
                    groups[cur.group].push(cur);
                    groups['Все каналы'].push(cur);
                    cur = null;
                }
            }
        };

        this.renderMain = function () {
            items.empty();
            var grid = $('<div class="tv-grid-final"></div>');
            
            grid.append('<div class="tv-header-final">Меню</div>');
            this.addNavRow(grid, '⚙️ ИЗМЕНИТЬ ПЛЕЙЛИСТ', function() { _this.renderSettings(); });

            grid.append('<div class="tv-header-final">Категории</div>');
            Object.keys(groups).sort().forEach(function (g) {
                if (g === 'Все каналы' && Object.keys(groups).length > 2) return;
                _this.addNavRow(grid, g + ' (' + groups[g].length + ')', function() {
                    _this.renderList(groups[g], g);
                });
            });
            items.append(grid);
            this.refresh();
        };

        this.renderList = function (list, title) {
            items.empty();
            var grid = $('<div class="tv-grid-final"></div>');
            this.addNavRow(grid, '🔙 НАЗАД К КАТЕГОРИЯМ', function() { _this.renderMain(); });
            grid.append('<div class="tv-header-final">' + title + '</div>');
            
            list.forEach(function (chan) {
                var epg_data = 'Программа передач временно недоступна';
                if (window.Lampa && Lampa.TV) {
                    var info = Lampa.TV.getEPG(chan.name);
                    if (info && info.current) epg_data = info.current.title;
                }

                var row = $('<div class="selector tv-row-final">' +
                    '<div class="tv-logo-final">' + (chan.logo ? '<img src="' + getSmartUrl(chan.logo) + '">' : '<span style="font-size:10px; color:#555">TV</span>') + '</div>' +
                    '<div class="tv-info-final">' +
                        '<span class="tv-name-final">' + chan.name + '</span>' +
                        '<div class="tv-epg-final">' + epg_data + '</div>' +
                    '</div>' +
                '</div>');

                row.on('hover:enter', function() {
                    Lampa.Player.play({ url: chan.url, title: chan.name });
                });
                grid.append(row);
            });
            items.append(grid);
            this.refresh();
        };

        this.addNavRow = function(container, text, action) {
            var row = $('<div class="selector tv-row-final"><div class="tv-info-final"><span class="tv-name-final">'+text+'</span></div></div>');
            row.on('hover:enter', action);
            container.append(row);
        };

        this.renderSettings = function() {
            items.empty().append('<div class="tv-header-final">Настройка</div>');
            var grid = $('<div class="tv-grid-final"></div>');
            this.addNavRow(grid, '➕ ВВЕСТИ URL ПЛЕЙЛИСТА (.M3U)', function() {
                Lampa.Input.edit({ value: Lampa.Storage.get('iptv_m3u_link', ''), free: true }, function(v) {
                    if(v) { Lampa.Storage.set('iptv_m3u_link', v); _this.load(v); }
                });
            });
            items.append(grid);
            this.refresh();
        };

        this.refresh = function() {
            Lampa.Controller.enable('content');
            items.scrollTop(0);
            setTimeout(function() {
                var f = items.find('.selector').first();
                if(f.length) Lampa.Controller.focus(f[0]);
            }, 200);
        };

        this.render = function () { return items; };
        this.start = function () { Lampa.Controller.enable('content'); };
        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () { items.remove(); };
    }

    function init() {
        Lampa.Component.add('iptv_lite', IPTVComponent);
        var menu = $('<li class="menu__item selector" data-action="iptv_lite"><div class="menu__ico"><svg height="22" viewBox="0 0 24 24" width="22" xmlns="http://www.w3.org/2000/svg"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 15c0-1.66 1.34-3 3-3 .35 0 .69.07 1 .18V6h5v2h-3v7.03A3.003 3.003 0 0 1 8 15z" fill="currentColor"/></svg></div><div class="menu__text">TiviMate IPTV</div></li>');
        menu.on('hover:enter', function () { Lampa.Activity.push({ title: 'TiviMate', component: 'iptv_lite', page: 1 }); });
        $('.menu .menu__list').append(menu);
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') init(); });
})();
