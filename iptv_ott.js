// ==Lampa==
// name: IPTV TiviMate
// version: 1.6.1
// description: Дизайн с разделением экрана (Каналы/Программа) и фикс загрузки.
// author: Gemini
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent(object) {
        var _this = this;
        var items = $('<div class="tivi-split"></div>');
        var left = $('<div class="tivi-left"></div>');
        var right = $('<div class="tivi-right"></div>');
        var groups = {};
        
        // CSS для разделенного экрана
        if (!$('#tivi-split-style').length) {
            $('head').append('<style id="tivi-split-style">' +
                '.tivi-split { display: flex; width: 100%; height: 100%; background: #0f1216; overflow: hidden; }' +
                '.tivi-left { width: 35%; height: 100%; overflow-y: auto; padding: 20px; box-sizing: border-box; border-right: 1px solid rgba(255,255,255,0.05); }' +
                '.tivi-right { width: 65%; height: 100%; padding: 40px; box-sizing: border-box; display: flex; flex-direction: column; background: linear-gradient(135deg, rgba(15,18,22,1) 0%, rgba(26,32,40,1) 100%); }' +
                '.tivi-row { display: flex; align-items: center; padding: 12px 15px; background: rgba(255,255,255,0.03); margin-bottom: 6px; border-radius: 6px; cursor: pointer; border-left: 4px solid transparent; transition: all 0.2s; }' +
                '.tivi-row.focus { background: rgba(52, 152, 219, 0.25) !important; border-left-color: #3498db; transform: translateX(5px); }' +
                '.tivi-chan-logo { width: 50px; height: 32px; margin-right: 15px; background: #000; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }' +
                '.tivi-chan-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }' +
                '.tivi-chan-name { font-size: 1.15em; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }' +
                '.epg-now-title { font-size: 2.4em; color: #fff; font-weight: bold; margin-bottom: 15px; line-height: 1.1; }' +
                '.epg-now-desc { font-size: 1.3em; color: rgba(255,255,255,0.5); line-height: 1.5; max-height: 300px; overflow: hidden; }' +
                '.epg-next-box { margin-top: auto; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); }' +
                '.epg-next-label { font-size: 0.8em; color: #3498db; text-transform: uppercase; margin-bottom: 8px; font-weight: bold; }' +
                '.tivi-section-label { font-size: 0.8em; color: rgba(255,255,255,0.3); text-transform: uppercase; margin: 25px 0 10px 5px; letter-spacing: 1px; }' +
                '</style>');
        }

        this.create = function () {
            // Регистрация EPG
            if (window.Lampa && Lampa.TV) {
                Lampa.TV.addSource('iptvx_one', 'https://iptvx.one/epg/epg.xml.gz');
            }
            
            items.append(left).append(right);
            var url = Lampa.Storage.get('iptv_m3u_link', '');
            if (!url) this.renderSettings();
            else this.load(url);
        };

        this.load = function(url) {
            left.html('<div style="text-align:center; padding:40px; color:#fff; opacity:0.5;">Загрузка...</div>');
            // Пробуем загрузить напрямую без прокси, чтобы не было 403
            $.ajax({
                url: url,
                method: 'GET',
                success: function(str) { _this.parse(str); _this.renderMain(); },
                error: function() {
                    // Если не вышло, пробуем через Lampac прокси
                    var proxy_url = 'https://corsproxy.io/?' + encodeURIComponent(url);
                    $.ajax({
                        url: proxy_url,
                        method: 'GET',
                        success: function(str) { _this.parse(str); _this.renderMain(); },
                        error: function() { 
                            Lampa.Noty.show('Ошибка загрузки плейлиста'); 
                            _this.renderSettings(); 
                        }
                    });
                }
            });
        };

        this.parse = function(str) {
            groups = {'Все каналы': []};
            var lines = str.split('\n');
            var cur = null;
            lines.forEach(function(l) {
                l = l.trim();
                if (l.indexOf('#EXTINF') === 0) {
                    var name = l.match(/,(.*)$/)?.[1].trim() || 'Без названия';
                    var id = l.match(/tvg-id="([^"]+)"/i)?.[1] || '';
                    var logo = l.match(/tvg-logo="([^"]+)"/i)?.[1] || '';
                    if (!logo && id) logo = 'https://iptvx.one/logo/' + id + '.png';

                    cur = {
                        name: name,
                        id: id,
                        logo: logo,
                        group: l.match(/group-title="([^"]+)"/i)?.[1] || 'Общие'
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

        this.updateEPGDisplay = function(chan) {
            right.empty();
            var now_title = "Программа не найдена";
            var now_desc = "Если вы только что установили плагин, подождите 1 минуту для индексации EPG.";
            var next_title = "";

            if (window.Lampa && Lampa.TV) {
                var epg = Lampa.TV.getEPG(chan.id || chan.name);
                if (epg && epg.current) {
                    now_title = epg.current.title;
                    now_desc = epg.current.description || "Описание отсутствует.";
                    if (epg.next) next_title = epg.next.title;
                }
            }

            var html = $(`
                <div style="display:flex; align-items:center; margin-bottom:30px;">
                    <div class="tivi-chan-logo" style="width:100px; height:60px; margin-right:25px;">
                        <img src="${chan.logo || ''}" onerror="this.style.display='none'">
                    </div>
                    <div>
                        <div style="font-size:1.8em; color:#fff; font-weight:bold;">${chan.name}</div>
                        <div style="font-size:1em; color:#3498db;">${chan.group}</div>
                    </div>
                </div>
                <div class="epg-now-title">${now_title}</div>
                <div class="epg-now-desc">${now_desc}</div>
                ${next_title ? `
                <div class="epg-next-box">
                    <div class="epg-next-label">Далее</div>
                    <div style="font-size:1.5em; color:#fff;">${next_title}</div>
                </div>` : ''}
            `);
            right.append(html);
        };

        this.renderMain = function() {
            left.empty().append('<div class="tivi-section-label">Меню</div>');
            this.addNavRow('⚙️ НАСТРОЙКИ', function() { _this.renderSettings(); });
            
            left.append('<div class="tivi-section-label">Категории</div>');
            Object.keys(groups).sort().forEach(function(g) {
                if (g === 'Все каналы' && Object.keys(groups).length > 2) return;
                _this.addNavRow(g, function() { _this.renderList(groups[g], g); });
            });
            this.focus();
        };

        this.renderList = function(list, title) {
            left.empty();
            this.addNavRow('🔙 НАЗАД К ГРУППАМ', function() { _this.renderMain(); });
            left.append('<div class="tivi-section-label">' + title + '</div>');

            list.forEach(function(chan) {
                var row = $('<div class="selector tivi-row">' +
                    '<div class="tivi-chan-logo"><img src="'+chan.logo+'" onerror="this.parentElement.innerHTML=\'TV\'"></div>' +
                    '<div class="tivi-chan-name">'+chan.name+'</div>' +
                '</div>');

                row.on('hover:focus', function() { _this.updateEPGDisplay(chan); });
                row.on('hover:enter', function() { Lampa.Player.play({ url: chan.url, title: chan.name }); });
                left.append(row);
            });
            this.focus();
        };

        this.addNavRow = function(text, action) {
            var row = $('<div class="selector tivi-row"><div class="tivi-chan-name">'+text+'</div></div>');
            row.on('hover:enter', action);
            left.append(row);
        };

        this.renderSettings = function() {
            left.empty().append('<div class="tivi-section-label">Плейлист</div>');
            this.addNavRow('➕ ВВЕСТИ URL (.M3U)', function() {
                Lampa.Input.edit({ value: Lampa.Storage.get('iptv_m3u_link', ''), free: true }, function(v) {
                    if(v) { Lampa.Storage.set('iptv_m3u_link', v); _this.load(v); }
                });
            });
            this.focus();
        };

        this.focus = function() {
            Lampa.Controller.enable('content');
            setTimeout(function() {
                var f = left.find('.selector').first();
                if (f.length) Lampa.Controller.focus(f[0]);
            }, 200);
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
