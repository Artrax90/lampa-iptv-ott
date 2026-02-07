// ==Lampa==
// name: IPTV TiviMate Classic
// version: 2.1.0
// description: Список каналов и программа на одном экране. Без категорий.
// author: Gemini
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent(object) {
        var _this = this;
        var items = $('<div class="tivi-classic"></div>');
        var channels = [];
        
        var style = `
            .tivi-classic { display: flex; width: 100%; height: 100%; background: #0a0c0f; position: absolute; top:0; left:0; }
            .tivi-list-side { width: 35%; height: 100%; border-right: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; }
            .tivi-info-side { width: 65%; height: 100%; padding: 40px; overflow-y: auto; background: linear-gradient(to bottom, #11151a, #0a0c0f); }
            
            .tivi-scroll { overflow-y: auto; flex-grow: 1; padding: 10px; }
            .tivi-head { padding: 20px; font-size: 0.8em; color: #3498db; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; }
            
            .tivi-card { padding: 12px 15px; margin-bottom: 6px; background: rgba(255,255,255,0.02); border-radius: 8px; cursor: pointer; border-left: 4px solid transparent; }
            .tivi-card.focus { background: #3498db !important; border-left-color: #fff; transform: scale(1.02); }
            .tivi-card-name { font-size: 1.15em; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            
            .tivi-details { display: flex; flex-direction: column; align-items: flex-start; }
            .tivi-big-logo { height: 120px; margin-bottom: 25px; border-radius: 10px; background: rgba(0,0,0,0.5); padding: 10px; }
            .tivi-big-logo img { height: 100%; object-fit: contain; }
            
            .tivi-chan-title { font-size: 2.5em; font-weight: bold; margin-bottom: 10px; color: #fff; }
            .tivi-now-title { font-size: 1.8em; color: #3498db; margin-bottom: 15px; font-weight: bold; }
            .tivi-now-desc { font-size: 1.3em; color: rgba(255,255,255,0.6); line-height: 1.6; margin-bottom: 30px; }
            
            .tivi-epg-table { width: 100%; border-top: 1px solid rgba(255,255,255,0.1); pt: 20px; }
            .tivi-epg-item { display: flex; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
            .tivi-epg-time { width: 80px; color: #3498db; font-weight: bold; font-size: 1.1em; }
            .tivi-epg-name { flex-grow: 1; color: #fff; font-size: 1.1em; }
        `;

        this.create = function () {
            if (!$('#tivi-style-c').length) $('head').append('<style id="tivi-style-c">' + style + '</style>');
            
            items.append(`
                <div class="tivi-list-side">
                    <div class="tivi-head">Телеканалы</div>
                    <div class="tivi-scroll" id="tivi-channels"></div>
                </div>
                <div class="tivi-info-side" id="tivi-details">
                    <div style="opacity:0.3; text-align:center; margin-top:100px;">Выберите канал из списка слева</div>
                </div>
            `);

            var url = Lampa.Storage.get('iptv_m3u_link', '');
            if (!url) this.renderSettings(); else this.load(url);
        };

        this.load = function (url) {
            var proxy = (Lampa.Utils && Lampa.Utils.proxyUrl) ? Lampa.Utils.proxyUrl(url) : url;
            $.ajax({
                url: proxy,
                method: 'GET',
                success: function (str) { _this.parse(str); _this.renderList(); },
                error: function () { _this.renderSettings(); }
            });
        };

        this.parse = function (str) {
            channels = [];
            var lines = str.split('\n'), cur = null;
            lines.forEach(function (l) {
                l = l.trim();
                if (l.indexOf('#EXTINF') === 0) {
                    var name = l.match(/,(.*)$/)?.[1].trim() || 'Без названия';
                    var tid = l.match(/tvg-id="([^"]+)"/i)?.[1] || '';
                    var logo = l.match(/tvg-logo="([^"]+)"/i)?.[1] || '';
                    if(!logo && tid) logo = 'https://iptvx.one/logo/' + tid + '.png';
                    cur = { name: name, id: tid, logo: logo };
                } else if (l.indexOf('http') === 0 && cur) {
                    cur.url = l;
                    channels.push(cur);
                    cur = null;
                }
            });
        };

        this.renderList = function () {
            var scroll = items.find('#tivi-channels').empty();
            
            // Кнопка настроек всегда сверху
            var settings = $('<div class="selector tivi-card"><div class="tivi-card-name">⚙️ НАСТРОЙКИ ПЛЕЙЛИСТА</div></div>');
            settings.on('hover:enter', function() { _this.renderSettings(); });
            scroll.append(settings);

            channels.forEach(function (chan) {
                var row = $('<div class="selector tivi-card"><div class="tivi-card-name">' + chan.name + '</div></div>');
                row.on('hover:focus', function () { _this.showDetails(chan); });
                row.on('hover:enter', function () { 
                    var p = (Lampa.Utils && Lampa.Utils.proxyUrl) ? Lampa.Utils.proxyUrl(chan.url) : chan.url;
                    Lampa.Player.play({ url: p, title: chan.name }); 
                });
                scroll.append(row);
            });
            this.focus();
        };

        this.showDetails = function (chan) {
            var info = items.find('#tivi-details').empty();
            var epg = { current: { title: "Программа не найдена", description: "Данные EPG отсутствуют." }, list: [] };
            
            if (window.Lampa && Lampa.TV) {
                var d = Lampa.TV.getEPG(chan.id || chan.name);
                if (d) epg = d;
            }

            var html = $(`
                <div class="tivi-details">
                    <div class="tivi-big-logo"><img src="${chan.logo}" onerror="this.src='https://bylampa.github.io/img/iptv.png'"></div>
                    <div class="tivi-chan-title">${chan.name}</div>
                    <div class="tivi-now-title">${epg.current.title}</div>
                    <div class="tivi-now-desc">${epg.current.description || ''}</div>
                    <div class="tivi-epg-table"></div>
                </div>
            `);

            if (epg.list && epg.list.length) {
                epg.list.slice(0, 10).forEach(function (e) {
                    html.find('.tivi-epg-table').append(`
                        <div class="tivi-epg-item">
                            <div class="tivi-epg-time">${e.time}</div>
                            <div class="tivi-epg-name">${e.title}</div>
                        </div>
                    `);
                });
            }

            info.append(html);
        };

        this.renderSettings = function () {
            Lampa.Input.edit({ 
                value: Lampa.Storage.get('iptv_m3u_link', ''), 
                title: 'Введите ссылку на M3U плейлист',
                free: true 
            }, function (v) {
                if (v) { 
                    Lampa.Storage.set('iptv_m3u_link', v); 
                    _this.load(v); 
                }
            });
        };

        this.focus = function () {
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
