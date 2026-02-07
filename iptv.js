// ==Lampa==
// name: IPTV TiviMate Trinity
// version: 2.0.0
// description: Фикс пустого экрана. Дизайн в 3 колонки.
// author: Gemini
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent(object) {
        var _this = this;
        var items = $('<div class="tivi-root"></div>');
        var groups = {};
        var current_list = [];
        
        // CSS - вшиваем максимально надежно
        var style = `
            .tivi-root { display: flex; width: 100%; height: 100%; background: #080a0d; color: #fff; position: absolute; z-index: 10; }
            .tivi-col { height: 100%; display: flex; flex-direction: column; overflow: hidden; border-right: 1px solid rgba(255,255,255,0.05); }
            .tivi-left { width: 25%; }
            .tivi-center { width: 45%; background: radial-gradient(circle at center, #161a20 0%, #080a0d 100%); align-items: center; justify-content: center; padding: 40px; text-align: center; }
            .tivi-right { width: 30%; background: rgba(0,0,0,0.3); border-right: none; }
            
            .tivi-scroll { overflow-y: auto; flex-grow: 1; padding: 10px; }
            .tivi-head { padding: 20px 15px 10px; font-size: 0.7em; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 2px; }
            
            .tivi-item { padding: 12px 15px; margin-bottom: 4px; background: rgba(255,255,255,0.03); border-radius: 6px; cursor: pointer; border-left: 4px solid transparent; }
            .tivi-item.focus { background: #3498db !important; border-left-color: #fff; transform: scale(1.02); }
            .tivi-item-txt { font-size: 1.1em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            
            .tivi-big-logo { width: 260px; height: 160px; margin-bottom: 30px; display: flex; align-items: center; justify-content: center; }
            .tivi-big-logo img { max-width: 100%; max-height: 100%; object-fit: contain; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.5)); }
            
            .tivi-title { font-size: 2.2em; font-weight: bold; margin-bottom: 15px; line-height: 1.2; }
            .tivi-desc { font-size: 1.2em; color: rgba(255,255,255,0.5); line-height: 1.6; max-height: 250px; overflow: hidden; }
            
            .tivi-epg-row { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
            .tivi-epg-time { color: #3498db; font-weight: bold; font-size: 0.9em; margin-bottom: 4px; }
            .tivi-epg-name { font-size: 1.05em; opacity: 0.9; }
            
            .tivi-error { padding: 20px; color: #ff4757; text-align: center; }
        `;

        this.create = function () {
            try {
                if (!$('#tivi-style').length) $('head').append('<style id="tivi-style">' + style + '</style>');
                
                // Сразу создаем структуру, чтобы не было пустого экрана
                items.append('<div class="tivi-col tivi-left"><div class="tivi-head">Загрузка...</div><div class="tivi-scroll"></div></div>');
                items.append('<div class="tivi-col tivi-center"><div class="tivi-error">Выберите канал или настройте плейлист</div></div>');
                items.append('<div class="tivi-col tivi-right"><div class="tivi-head">Программа</div><div class="tivi-scroll"></div></div>');

                var url = Lampa.Storage.get('iptv_m3u_link', '');
                if (!url) this.renderSettings(); else this.load(url);
            } catch (e) {
                items.html('<div class="tivi-error">Ошибка инициализации: ' + e.message + '</div>');
            }
        };

        this.load = function (url) {
            var _this = this;
            var proxy = (Lampa.Utils && Lampa.Utils.proxyUrl) ? Lampa.Utils.proxyUrl(url) : url;
            $.ajax({
                url: proxy,
                method: 'GET',
                success: function (str) { _this.parse(str); _this.renderGroups(); },
                error: function () { _this.renderSettings('Ошибка загрузки плейлиста'); }
            });
        };

        this.parse = function (str) {
            groups = { 'Все каналы': [] };
            var lines = str.split('\n'), cur = null;
            lines.forEach(function (l) {
                l = l.trim();
                if (l.indexOf('#EXTINF') === 0) {
                    var name = l.match(/,(.*)$/)?.[1].trim() || 'Без названия';
                    var id = l.match(/tvg-id="([^"]+)"/i)?.[1] || '';
                    var logo = l.match(/tvg-logo="([^"]+)"/i)?.[1] || '';
                    
                    // Умная замена логотипа
                    if (!logo && name.toLowerCase().indexOf('первый') > -1) logo = 'https://iptvx.one/logo/pervy.png';
                    if (!logo && name.toLowerCase().indexOf('россия 1') > -1) logo = 'https://iptvx.one/logo/rossia1.png';
                    if (!logo && id) logo = 'https://iptvx.one/logo/' + id + '.png';

                    cur = { name: name, id: id, logo: logo, group: l.match(/group-title="([^"]+)"/i)?.[1] || 'Общие' };
                } else if (l.indexOf('http') === 0 && cur) {
                    cur.url = l;
                    if (!groups[cur.group]) groups[cur.group] = [];
                    groups[cur.group].push(cur);
                    groups['Все каналы'].push(cur);
                    cur = null;
                }
            });
        };

        this.renderGroups = function () {
            var scroll = items.find('.tivi-left .tivi-scroll').empty();
            items.find('.tivi-left .tivi-head').text('Категории');
            
            this.addBtn(scroll, '⚙️ НАСТРОЙКИ', function () { _this.renderSettings(); });
            
            Object.keys(groups).sort().forEach(function (g) {
                if (g === 'Все каналы' && Object.keys(groups).length > 1) return;
                _this.addBtn(scroll, g.toUpperCase(), function () { _this.renderChannels(groups[g], g); });
            });
            this.focus();
        };

        this.renderChannels = function (list, title) {
            var scroll = items.find('.tivi-left .tivi-scroll').empty();
            items.find('.tivi-left .tivi-head').text(title);
            
            this.addBtn(scroll, '🔙 НАЗАД', function () { _this.renderGroups(); });
            
            list.forEach(function (chan) {
                var row = $('<div class="selector tivi-item"><div class="tivi-item-txt">' + chan.name + '</div></div>');
                row.on('hover:focus', function () { _this.updateEPG(chan); });
                row.on('hover:enter', function () { 
                    var p = (Lampa.Utils && Lampa.Utils.proxyUrl) ? Lampa.Utils.proxyUrl(chan.url) : chan.url;
                    Lampa.Player.play({ url: p, title: chan.name }); 
                });
                scroll.append(row);
            });
            this.focus();
        };

        this.updateEPG = function (chan) {
            var center = items.find('.tivi-center').empty();
            var right = items.find('.tivi-right .tivi-scroll').empty();
            
            var epg = { current: { title: "Программа не найдена", description: "Данные EPG загружаются или отсутствуют для этого канала." }, list: [] };
            
            if (window.Lampa && Lampa.TV) {
                var d = Lampa.TV.getEPG(chan.id) || Lampa.TV.getEPG(chan.name);
                if (d) epg = d;
            }

            center.append(`
                <div class="tivi-big-logo"><img src="${chan.logo}" onerror="this.src='https://bylampa.github.io/img/iptv.png'"></div>
                <div class="tivi-title">${epg.current.title}</div>
                <div class="tivi-desc">${epg.current.description || ''}</div>
                <div style="margin-top:20px; color:#3498db;">Нажмите OK для просмотра</div>
            `);

            if (epg.list && epg.list.length) {
                epg.list.forEach(function (e) {
                    right.append(`<div class="tivi-epg-row"><div class="tivi-epg-time">${e.time}</div><div class="tivi-epg-name">${e.title}</div></div>`);
                });
            }
        };

        this.addBtn = function (cont, txt, action) {
            var b = $('<div class="selector tivi-item"><div class="tivi-item-txt">' + txt + '</div></div>');
            b.on('hover:enter', action);
            cont.append(b);
        };

        this.renderSettings = function (err) {
            var scroll = items.find('.tivi-left .tivi-scroll').empty();
            items.find('.tivi-left .tivi-head').text('Настройка');
            if (err) scroll.append('<div class="tivi-error">' + err + '</div>');
            this.addBtn(scroll, '➕ УКАЗАТЬ ПЛЕЙЛИСТ', function () {
                Lampa.Input.edit({ value: Lampa.Storage.get('iptv_m3u_link', ''), free: true }, function (v) {
                    if (v) { Lampa.Storage.set('iptv_m3u_link', v); _this.load(v); }
                });
            });
            this.focus();
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
