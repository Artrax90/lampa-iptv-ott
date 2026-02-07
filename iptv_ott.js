// ==Lampa==
// name: IPTV TiviMate Pro
// version: 1.8.1
// description: Три колонки: Каналы | Инфо | Программа. Исправлен пустой экран.
// author: Gemini
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent(object) {
        var _this = this;
        // Создаем контейнер сразу, чтобы Lampa было что рендерить
        var items = $('<div class="tivi-dash-wrapper"><div class="tivi-loading">Загрузка интерфейса...</div></div>');
        var groups = {};
        
        // Стили
        if (!$('#tivi-dash-style').length) {
            $('head').append('<style id="tivi-dash-style">' +
                '.tivi-dash-wrapper { display: flex; width: 100%; height: 100%; background: #0c0e12; color: #fff; font-family: sans-serif; }' +
                '.tivi-col { height: 100%; overflow-y: auto; display: flex; flex-direction: column; box-sizing: border-box; }' +
                '.tivi-col-1 { width: 25%; border-right: 1px solid rgba(255,255,255,0.05); padding: 15px; }' +
                '.tivi-col-2 { width: 45%; border-right: 1px solid rgba(255,255,255,0.05); padding: 30px; align-items: center; justify-content: center; text-align: center; background: radial-gradient(circle at center, rgba(52, 152, 219, 0.07) 0%, transparent 100%); }' +
                '.tivi-col-3 { width: 30%; padding: 15px; background: rgba(0,0,0,0.1); }' +
                '.tivi-loading { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:1.5em; opacity:0.5; }' +
                '.tivi-btn { padding: 12px 15px; background: rgba(255,255,255,0.03); margin-bottom: 5px; border-radius: 6px; cursor: pointer; border-left: 4px solid transparent; transition: 0.2s; }' +
                '.tivi-btn.focus { background: #3498db !important; border-left-color: #fff; transform: translateX(5px); }' +
                '.tivi-btn-text { font-size: 1.1em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
                '.tivi-big-logo { width: 220px; height: 130px; background: #000; border-radius: 12px; margin-bottom: 25px; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.6); }' +
                '.tivi-big-logo img { max-width: 85%; max-height: 85%; object-fit: contain; }' +
                '.tivi-main-title { font-size: 2.4em; font-weight: bold; margin-bottom: 15px; line-height: 1.1; }' +
                '.tivi-main-desc { font-size: 1.3em; color: rgba(255,255,255,0.5); line-height: 1.5; margin-bottom: 30px; }' +
                '.tivi-epg-row { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }' +
                '.tivi-epg-time { color: #3498db; font-weight: bold; font-size: 0.9em; margin-bottom: 3px; }' +
                '.tivi-epg-name { color: rgba(255,255,255,0.9); font-size: 1em; }' +
                '.tivi-label { font-size: 0.75em; color: rgba(255,255,255,0.3); text-transform: uppercase; margin: 20px 0 10px; letter-spacing: 2px; }' +
                '</style>');
        }

        // Безопасный прокси
        function getSafeUrl(url) {
            if (!url) return '';
            if (url.indexOf('http') !== 0) return url;
            try {
                return (Lampa.Utils && Lampa.Utils.proxyUrl) ? Lampa.Utils.proxyUrl(url) : url;
            } catch(e) { return url; }
        }

        this.create = function () {
            if (Lampa.TV) Lampa.TV.addSource('iptvx_fixed', 'https://iptvx.one/epg/epg.xml.gz');
            
            var url = Lampa.Storage.get('iptv_m3u_link', '');
            if (!url) this.renderSettings();
            else this.load(url);
        };

        this.load = function (url) {
            $.ajax({
                url: getSafeUrl(url),
                method: 'GET',
                success: function (str) { 
                    _this.parse(str); 
                    _this.buildInterface(); 
                    _this.renderGroups(); 
                },
                error: function () { 
                    Lampa.Noty.show('Ошибка загрузки плейлиста'); 
                    _this.renderSettings(); 
                }
            });
        };

        this.parse = function (str) {
            groups = { 'Все каналы': [] };
            var lines = str.split('\n'), cur = null;
            lines.forEach(function (l) {
                l = l.trim();
                if (l.indexOf('#EXTINF') === 0) {
                    var tid = l.match(/tvg-id="([^"]+)"/i)?.[1] || '';
                    cur = {
                        name: l.match(/,(.*)$/)?.[1].trim() || 'No name',
                        id: tid,
                        logo: l.match(/tvg-logo="([^"]+)"/i)?.[1] || (tid ? 'https://iptvx.one/logo/' + tid + '.png' : ''),
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

        this.buildInterface = function() {
            items.empty();
            var c1 = $('<div class="tivi-col tivi-col-1"></div>');
            var c2 = $('<div class="tivi-col tivi-col-2"></div>');
            var c3 = $('<div class="tivi-col tivi-col-3"></div>');
            items.append(c1).append(c2).append(c3);
        };

        this.updateDetails = function (chan) {
            var c2 = items.find('.tivi-col-2').empty();
            var c3 = items.find('.tivi-col-3').empty();
            
            var now = { title: "Программа не загружена", desc: "Подождите завершения индексации EPG (1-2 мин)." };
            var list = [];

            if (Lampa.TV) {
                var epg = Lampa.TV.getEPG(chan.id || chan.name);
                if (epg) {
                    if (epg.current) {
                        now.title = epg.current.title;
                        now.desc = epg.current.description || "Описание этой программы отсутствует.";
                    }
                    if (epg.list) list = epg.list.slice(0, 12);
                }
            }

            // Центр
            c2.append(`
                <div class="tivi-big-logo"><img src="${chan.logo}" onerror="this.src=''"></div>
                <div class="tivi-main-title">${now.title}</div>
                <div class="tivi-main-desc">${now.desc}</div>
                <div style="font-size:1.1em; color:#3498db; background:rgba(52,152,219,0.1); padding:10px 20px; border-radius:30px;">
                    Нажмите <b>OK</b> чтобы смотреть <b>${chan.name}</b>
                </div>
            `);

            // Право
            c3.append('<div class="tivi-label">В эфире сегодня</div>');
            if (list.length) {
                list.forEach(function (e) {
                    c3.append(`
                        <div class="tivi-epg-row">
                            <div class="tivi-epg-time">${e.time}</div>
                            <div class="tivi-epg-name">${e.title}</div>
                        </div>
                    `);
                });
            } else {
                c3.append('<div style="padding:20px; opacity:0.3; text-align:center;">Данные EPG отсутствуют</div>');
            }
        };

        this.renderGroups = function () {
            var c1 = items.find('.tivi-col-1').empty();
            c1.append('<div class="tivi-label">Меню</div>');
            this.addBtn(c1, '⚙️ НАСТРОЙКИ', function () { _this.renderSettings(); });
            c1.append('<div class="tivi-label">Категории</div>');
            Object.keys(groups).sort().forEach(function (g) {
                if (g === 'Все каналы' && Object.keys(groups).length > 2) return;
                _this.addBtn(c1, g.toUpperCase(), function () { _this.renderList(groups[g], g); });
            });
            this.focus();
        };

        this.renderList = function (list, title) {
            var c1 = items.find('.tivi-col-1').empty();
            this.addBtn(c1, '🔙 НАЗАД', function () { _this.renderGroups(); });
            c1.append('<div class="tivi-label">' + title + '</div>');
            list.forEach(function (chan) {
                var row = $('<div class="selector tivi-btn"><div class="tivi-btn-text">' + chan.name + '</div></div>');
                row.on('hover:focus', function () { _this.updateDetails(chan); });
                row.on('hover:enter', function () { 
                    Lampa.Player.play({ url: getSafeUrl(chan.url), title: chan.name }); 
                });
                c1.append(row);
            });
            this.focus();
        };

        this.addBtn = function (cont, txt, action) {
            var row = $('<div class="selector tivi-btn"><div class="tivi-btn-text">' + txt + '</div></div>');
            row.on('hover:enter', action);
            cont.append(row);
        };

        this.renderSettings = function () {
            var c1 = items.find('.tivi-col-1').empty();
            c1.append('<div class="tivi-label">Конфигурация</div>');
            this.addBtn(c1, '➕ ВВЕСТИ URL ПЛЕЙЛИСТА', function () {
                Lampa.Input.edit({ value: Lampa.Storage.get('iptv_m3u_link', ''), free: true }, function (v) {
                    if (v) { Lampa.Storage.set('iptv_m3u_link', v); _this.load(v); }
                });
            });
            this.focus();
        };

        this.focus = function () {
            Lampa.Controller.enable('content');
            setTimeout(function () {
                var f = items.find('.selector').first();
                if (f.length) Lampa.Controller.focus(f[0]);
            }, 200);
        };

        this.render = function () { return items; };
        this.start = function () { this.focus(); };
        this.pause = function () { };
        this.stop = function () { };
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
