// ==Lampa==
// name: IPTV TiviMate Pro
// version: 1.5.1
// description: Дизайн TiviMate. Фикс EPG по tvg-id и авто-логотипы.
// author: Gemini
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent(object) {
        var _this = this;
        var items = $('<div class="tivimate-base"></div>');
        var groups = {};
        var favorites = Lampa.Storage.get('iptv_fav_list', []);

        if (!$('#tivimate-style-v11').length) {
            $('head').append('<style id="tivimate-style-v11">' +
                '.tivimate-base { width:100%; height: 100vh; overflow-y: auto; background: #0f1216; padding: 20px; box-sizing: border-box; }' +
                '.tv-item-base { display: flex; align-items: center; padding: 12px 18px; background: rgba(255,255,255,0.03); margin-bottom: 6px; border-radius: 6px; border-left: 4px solid transparent; cursor: pointer; }' +
                '.tv-item-base.focus { background: rgba(52, 152, 219, 0.25) !important; border-left-color: #3498db; }' +
                '.tv-logo-base { width: 55px; height: 35px; margin-right: 18px; background: #000; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }' +
                '.tv-logo-base img { max-width: 100%; max-height: 100%; object-fit: contain; }' +
                '.tv-info-base { flex: 1; overflow: hidden; }' +
                '.tv-name-base { font-size: 1.2em; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; font-weight: 500; }' +
                '.tv-epg-base { font-size: 0.9em; color: #3498db; margin-top: 4px; opacity: 0.9; }' +
                '.tv-group-v11 { font-size: 0.85em; color: rgba(255,255,255,0.3); text-transform: uppercase; margin: 25px 0 10px 5px; letter-spacing: 1px; }' +
                '.activity__footer { display: none !important; }' +
                '</style>');
        }

        this.create = function () {
            // Исправляем ссылку на XMLTV для iptvx
            if (window.Lampa && Lampa.TV) {
                Lampa.TV.addSource('iptvx_fix', 'https://iptvx.one/epg/epg.xml.gz');
            }
            
            var url = Lampa.Storage.get('iptv_m3u_link', '');
            if (!url) this.renderSettings();
            else this.load(url);
        };

        this.load = function(url) {
            items.html('<div style="text-align:center; padding:50px; color:#fff; opacity:0.5;">Загрузка TiviMate...</div>');
            $.ajax({
                url: url.indexOf('http') === 0 ? Lampa.Utils.proxyUrl(url) : url,
                method: 'GET',
                success: function(str) { _this.parse(str); _this.renderMain(); },
                error: function() { Lampa.Noty.show('Ошибка загрузки плейлиста'); _this.renderSettings(); }
            });
        };

        this.parse = function (str) {
            groups = {'Все каналы': []};
            var lines = str.split('\n');
            var cur = null;

            lines.forEach(function(line) {
                line = line.trim();
                if (line.indexOf('#EXTINF') === 0) {
                    cur = {
                        name: line.match(/,(.*)$/)?.[1].trim() || 'Без названия',
                        logo: line.match(/tvg-logo="([^"]+)"/i)?.[1] || '',
                        id: line.match(/tvg-id="([^"]+)"/i)?.[1] || '',
                        group: line.match(/group-title="([^"]+)"/i)?.[1] || 'Разное'
                    };
                } else if (line.indexOf('http') === 0 && cur) {
                    cur.url = line;
                    // Если логотипа нет в плейлисте, пробуем найти в базе Lampa по названию
                    if(!cur.logo && window.Lampa && Lampa.Icon) {
                        cur.logo = Lampa.Icon.get(cur.name);
                    }
                    if (!groups[cur.group]) groups[cur.group] = [];
                    groups[cur.group].push(cur);
                    groups['Все каналы'].push(cur);
                    cur = null;
                }
            });
        };

        this.renderMain = function () {
            items.empty();
            this.drawRow('⚙️ НАСТРОЙКИ ПЛЕЙЛИСТА', function() { _this.renderSettings(); });
            items.append('<div class="tv-group-v11">Категории</div>');
            Object.keys(groups).sort().forEach(function (g) {
                if (g === 'Все каналы' && Object.keys(groups).length > 2) return;
                _this.drawRow(g.toUpperCase() + ' (' + groups[g].length + ')', function() {
                    _this.renderList(groups[g], g);
                });
            });
            this.refresh();
        };

        this.renderList = function (list, title) {
            items.empty();
            this.drawRow('🔙 НАЗАД', function() { _this.renderMain(); });
            items.append('<div class="tv-group-v11">' + title + '</div>');
            
            list.forEach(function (chan) {
                // Ищем EPG: сначала по ID, потом по имени
                var epg_text = "Программа временно недоступна";
                if (window.Lampa && Lampa.TV) {
                    var data = Lampa.TV.getEPG(chan.id || chan.name);
                    if (data && data.current) epg_text = data.current.title;
                }

                var row = $('<div class="selector tv-item-base">' +
                    '<div class="tv-logo-base">' + (chan.logo ? '<img src="' + chan.logo + '">' : '<span>TV</span>') + '</div>' +
                    '<div class="tv-info-base">' +
                        '<span class="tv-name-base">' + chan.name + '</span>' +
                        '<div class="tv-epg-base">' + epg_text + '</div>' +
                    '</div>' +
                '</div>');

                row.on('hover:enter', function() {
                    Lampa.Player.play({ url: chan.url, title: chan.name });
                });
                items.append(row);
            });
            this.refresh();
        };

        this.drawRow = function(text, action) {
            var row = $('<div class="selector tv-item-base"><div class="tv-info-base"><span class="tv-name-base">'+text+'</span></div></div>');
            row.on('hover:enter', action);
            items.append(row);
        };

        this.renderSettings = function() {
            items.empty().append('<div class="tv-group-v11">Настройка</div>');
            this.drawRow('➕ ОБНОВИТЬ ССЫЛКУ ПЛЕЙЛИСТА', function() {
                Lampa.Input.edit({ value: Lampa.Storage.get('iptv_m3u_link', ''), free: true }, function(v) {
                    if(v) { Lampa.Storage.set('iptv_m3u_link', v); _this.load(v); }
                });
            });
            this.refresh();
        };

        this.refresh = function() {
            Lampa.Controller.enable('content');
            setTimeout(function() {
                var f = items.find('.selector').first();
                if(f.length) Lampa.Controller.focus(f[0]);
            }, 200);
        };

        this.render = function () { return items; };
        this.start = function () { this.refresh(); };
        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () { items.remove(); };
    }

    function init() {
        Lampa.Component.add('iptv_lite', IPTVComponent);
        var btn = $('<li class="menu__item selector" data-action="iptv_lite"><div class="menu__ico"><svg height="22" viewBox="0 0 24 24" width="22" xmlns="http://www.w3.org/2000/svg"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 15c0-1.66 1.34-3 3-3 .35 0 .69.07 1 .18V6h5v2h-3v7.03A3.003 3.003 0 0 1 8 15z" fill="currentColor"/></svg></div><div class="menu__text">TiviMate</div></li>');
        btn.on('hover:enter', function () { Lampa.Activity.push({ title: 'TiviMate', component: 'iptv_lite', page: 1 }); });
        $('.menu .menu__list').append(btn);
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') init(); });
})();
