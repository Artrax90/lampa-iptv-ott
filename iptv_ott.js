// ==Lampa==
// name: IPTV TiviMate
// version: 1.4.6
// description: Исправлена ошибка загрузки плейлиста
// author: Gemini
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent(object) {
        var _this = this;
        var items = $('<div class="tivimate-root"></div>');
        var groups = {};
        var favorites = Lampa.Storage.get('iptv_fav_list', []);

        if (!$('#tivimate-style-v6').length) {
            $('head').append('<style id="tivimate-style-v6">' +
                '.tivimate-root { width:100%; height: 100%; background: #0f1216; padding: 20px; box-sizing: border-box; }' +
                '.tv-grid-v6 { display: flex; flex-direction: column; gap: 6px; }' +
                '.tv-item-v6 { display: flex; align-items: center; padding: 12px 18px; background: #1a1e23; border-radius: 6px; border-left: 4px solid transparent; cursor: pointer; transition: 0.2s; }' +
                '.tv-item-v6.focus { background: #2d343c !important; border-left-color: #3498db; transform: scale(1.01); }' +
                '.tv-logo-v6 { width: 50px; height: 32px; background: #000; border-radius: 4px; margin-right: 15px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }' +
                '.tv-logo-v6 img { max-width: 100%; max-height: 100%; object-fit: contain; }' +
                '.tv-info-v6 { flex: 1; overflow: hidden; }' +
                '.tv-name-v6 { font-size: 1.2em; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }' +
                '.tv-epg-v6 { font-size: 0.85em; color: #3498db; margin-top: 3px; opacity: 0.8; }' +
                '.tv-head-v6 { font-size: 0.8em; color: rgba(255,255,255,0.3); text-transform: uppercase; margin: 20px 0 10px 5px; letter-spacing: 1px; }' +
                '.activity__footer { display: none !important; }' +
                '</style>');
        }

        // Прокси только для логотипов, если они не на https
        function smartProxy(url) {
            if (!url) return '';
            if (url.indexOf('https') === -1 && window.location.protocol === 'https:') {
                return 'https://corsproxy.io/?' + encodeURIComponent(url);
            }
            return url;
        }

        this.create = function () {
            var url = Lampa.Storage.get('iptv_m3u_link', '');
            if (!url) this.renderSettings();
            else this.loadPlaylist(url);
        };

        this.loadPlaylist = function(url) {
            items.html('<div style="color:#fff; text-align:center; padding:50px; opacity:0.5;">Загрузка каналов...</div>');
            
            // Пробуем загрузить напрямую, если не выйдет - через прокси
            $.ajax({
                url: url,
                method: 'GET',
                success: function(data) { _this.parseAndRender(data); },
                error: function() {
                    // Вторая попытка через прокси при ошибке CORS
                    $.ajax({
                        url: 'https://corsproxy.io/?' + encodeURIComponent(url),
                        method: 'GET',
                        success: function(data) { _this.parseAndRender(data); },
                        error: function() {
                            Lampa.Noty.show('Ошибка: Не удалось загрузить плейлист');
                            _this.renderSettings();
                        }
                    });
                }
            });
        };

        this.parseAndRender = function(str) {
            groups = {'Все каналы': []};
            var lines = str.split('\n');
            var cur = null;
            lines.forEach(function(line) {
                line = line.trim();
                if (line.indexOf('#EXTINF') === 0) {
                    cur = {
                        name: line.match(/,(.*)$/)?.[1].trim() || 'Без названия',
                        logo: line.match(/tvg-logo="([^"]+)"/i)?.[1] || '',
                        group: line.match(/group-title="([^"]+)"/i)?.[1] || 'Разное'
                    };
                } else if (line.indexOf('http') === 0 && cur) {
                    cur.url = line;
                    if (!groups[cur.group]) groups[cur.group] = [];
                    groups[cur.group].push(cur);
                    groups['Все каналы'].push(cur);
                    cur = null;
                }
            });
            this.renderMain();
        };

        this.renderMain = function() {
            items.empty();
            var grid = $('<div class="tv-grid-v6"></div>');
            
            grid.append('<div class="tv-head-v6">Управление</div>');
            this.addItem(grid, '⚙️ СМЕНИТЬ ПЛЕЙЛИСТ', function() { _this.renderSettings(); });
            
            grid.append('<div class="tv-head-v6">Категории</div>');
            Object.keys(groups).sort().forEach(function(g) {
                _this.addItem(grid, g + ' (' + groups[g].length + ')', function() {
                    _this.renderList(groups[g], g);
                });
            });

            items.append(grid);
            this.focusFirst();
        };

        this.renderList = function(list, title) {
            items.empty();
            var grid = $('<div class="tv-grid-v6"></div>');
            
            this.addItem(grid, '🔙 НАЗАД К ГРУППАМ', function() { _this.renderMain(); });
            grid.append('<div class="tv-head-v6">' + title + '</div>');

            list.forEach(function(chan) {
                var row = $('<div class="selector tv-item-v6">' +
                    '<div class="tv-logo-v6">' + (chan.logo ? '<img src="'+smartProxy(chan.logo)+'">' : '<span>TV</span>') + '</div>' +
                    '<div class="tv-info-v6"><span class="tv-name-v6">'+chan.name+'</span><div class="tv-epg-v6">Программа передач доступна при нажатии</div></div>' +
                '</div>');
                
                row.on('hover:enter', function() {
                    Lampa.Player.play({ url: chan.url, title: chan.name });
                });
                grid.append(row);
            });

            items.append(grid);
            this.focusFirst();
        };

        this.addItem = function(container, title, action) {
            var el = $('<div class="selector tv-item-v6"><div class="tv-info-v6"><span class="tv-name-v6">'+title+'</span></div></div>');
            el.on('hover:enter', action);
            container.append(el);
        };

        this.renderSettings = function() {
            items.empty().append('<div class="tv-head-v6">Настройка плейлиста</div>');
            var grid = $('<div class="tv-grid-v6"></div>');
            this.addItem(grid, '➕ ВВЕСТИ URL ПЛЕЙЛИСТА (.M3U)', function() {
                Lampa.Input.edit({ value: Lampa.Storage.get('iptv_m3u_link', ''), free: true }, function(v) {
                    if(v) { Lampa.Storage.set('iptv_m3u_link', v); _this.loadPlaylist(v); }
                });
            });
            items.append(grid);
            this.focusFirst();
        };

        this.focusFirst = function() {
            Lampa.Controller.enable('content');
            var first = items.find('.selector').first();
            if(first.length) Lampa.Controller.focus(first[0]);
        };

        this.render = function () { return items; };
        this.start = function () { this.focusFirst(); };
        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () { items.remove(); };
    }

    function init() {
        Lampa.Component.add('iptv_lite', IPTVComponent);
        var item = $('<li class="menu__item selector" data-action="iptv_lite"><div class="menu__ico"><svg height="22" viewBox="0 0 24 24" width="22" xmlns="http://www.w3.org/2000/svg"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 15c0-1.66 1.34-3 3-3 .35 0 .69.07 1 .18V6h5v2h-3v7.03A3.003 3.003 0 0 1 8 15z" fill="currentColor"/></svg></div><div class="menu__text">TiviMate IPTV</div></li>');
        item.on('hover:enter', function () { Lampa.Activity.push({ title: 'TiviMate', component: 'iptv_lite', page: 1 }); });
        $('.menu .menu__list').append(item);
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') init(); });
})();
