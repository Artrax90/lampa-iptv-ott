// ==Lampa==
// name: IPTV TiviMate
// version: 1.5.2
// description: Исправление ошибок Start и ProxyUrl. Работа с tvg-id.
// author: Gemini
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent(object) {
        var _this = this;
        var items = $('<div class="tivi-base"></div>');
        var groups = {};
        
        // Стили в духе TiviMate
        if (!$('#tivi-style').length) {
            $('head').append('<style id="tivi-style">' +
                '.tivi-base { width:100%; height: 100%; background: #0f1216; padding: 20px; box-sizing: border-box; overflow-y: auto; }' +
                '.tivi-row { display: flex; align-items: center; padding: 12px; background: rgba(255,255,255,0.03); margin-bottom: 5px; border-radius: 5px; border-left: 4px solid transparent; }' +
                '.tivi-row.focus { background: rgba(52, 152, 219, 0.2) !important; border-left-color: #3498db; }' +
                '.tivi-logo { width: 50px; height: 30px; margin-right: 15px; background: #000; border-radius: 3px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }' +
                '.tivi-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }' +
                '.tivi-info { flex: 1; overflow: hidden; }' +
                '.tivi-name { font-size: 1.2em; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }' +
                '.tivi-epg { font-size: 0.9em; color: #3498db; margin-top: 3px; }' +
                '.tivi-head { font-size: 0.8em; color: rgba(255,255,255,0.3); text-transform: uppercase; margin: 20px 0 10px; letter-spacing: 1px; }' +
                '.activity__footer { display: none !important; }' +
                '</style>');
        }

        // Простой прокси, если системный недоступен
        function proxy(url) {
            if (!url) return '';
            if (url.indexOf('http://') === 0) return 'https://corsproxy.io/?' + encodeURIComponent(url);
            return url;
        }

        this.create = function () {
            // Регистрируем правильный источник XMLTV
            if (window.Lampa && Lampa.TV) {
                Lampa.TV.addSource('iptvx_fixed', 'https://iptvx.one/epg/epg.xml.gz');
            }
            
            var url = Lampa.Storage.get('iptv_m3u_link', '');
            if (!url) this.renderSettings();
            else this.load(url);
        };

        this.load = function(url) {
            items.html('<div style="text-align:center; padding:40px; color:#fff;">Загрузка каналов...</div>');
            $.ajax({
                url: proxy(url),
                method: 'GET',
                success: function(str) { _this.parse(str); _this.renderMain(); },
                error: function() { Lampa.Noty.show('Ошибка плейлиста'); _this.renderSettings(); }
            });
        };

        this.parse = function(str) {
            groups = {'Все каналы': []};
            var lines = str.split('\n');
            var cur = null;

            lines.forEach(function(l) {
                l = l.trim();
                if (l.indexOf('#EXTINF') === 0) {
                    cur = {
                        name: l.match(/,(.*)$/)?.[1].trim() || 'No name',
                        logo: l.match(/tvg-logo="([^"]+)"/i)?.[1] || '',
                        id: l.match(/tvg-id="([^"]+)"/i)?.[1] || '',
                        group: l.match(/group-title="([^"]+)"/i)?.[1] || 'Разное'
                    };
                } else if (l.indexOf('http') === 0 && cur) {
                    cur.url = l;
                    if (!groups[cur.group]) groups[cur.group] = [];
                    groups[cur.group].push(cur);
                    groups['Все каналы'].push(cur);
                    cur = null;
                }
            });
        };

        this.renderMain = function() {
            items.empty().append('<div class="tivi-head">Меню</div>');
            this.drawRow('⚙️ Настройки плейлиста', function() { _this.renderSettings(); });
            
            items.append('<div class="tivi-head">Категории</div>');
            Object.keys(groups).sort().forEach(function(g) {
                _this.drawRow(g + ' (' + groups[g].length + ')', function() { _this.renderList(groups[g], g); });
            });
            this.focus();
        };

        this.renderList = function(list, title) {
            items.empty();
            this.drawRow('🔙 Назад', function() { _this.renderMain(); });
            items.append('<div class="tivi-head">' + title + '</div>');

            list.forEach(function(chan) {
                var epg = "Программа передач загружается...";
                if (Lampa.TV) {
                    // Ищем сначала по ID (pervy, rossia1), потом по имени
                    var data = Lampa.TV.getEPG(chan.id || chan.name);
                    if (data && data.current) epg = data.current.title;
                }

                var img = chan.logo || (Lampa.Icon ? Lampa.Icon.get(chan.name) : '');
                
                var row = $('<div class="selector tivi-row">' +
                    '<div class="tivi-logo">' + (img ? '<img src="'+proxy(img)+'">' : '<span>TV</span>') + '</div>' +
                    '<div class="tivi-info"><div class="tivi-name">'+chan.name+'</div><div class="tivi-epg">'+epg+'</div></div>' +
                '</div>');

                row.on('hover:enter', function() { Lampa.Player.play({ url: chan.url, title: chan.name }); });
                items.append(row);
            });
            this.focus();
        };

        this.drawRow = function(text, action) {
            var row = $('<div class="selector tivi-row"><div class="tivi-info"><div class="tivi-name">'+text+'</div></div></div>');
            row.on('hover:enter', action);
            items.append(row);
        };

        this.renderSettings = function() {
            items.empty().append('<div class="tivi-head">Плейлист</div>');
            this.drawRow('➕ Ввести URL плейлиста', function() {
                Lampa.Input.edit({ value: Lampa.Storage.get('iptv_m3u_link', ''), free: true }, function(v) {
                    if(v) { Lampa.Storage.set('iptv_m3u_link', v); _this.load(v); }
                });
            });
            this.focus();
        };

        this.focus = function() {
            Lampa.Controller.enable('content');
            var f = items.find('.selector').first();
            if (f.length) Lampa.Controller.focus(f[0]);
        };

        this.render = function () { return items; };
        this.start = function () { this.focus(); };
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
