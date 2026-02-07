// ==Lampa==
// name: IPTV TiviMate
// version: 1.4.3
// description: Исправлены ошибки proxyUrl и dispatchEvent
// author: Gemini
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent(object) {
        var _this = this;
        var items = $('<div class="iptv-list"></div>');
        var groups = {};
        
        this.create = function () {
            var style = '<style>' +
                '.iptv-list { display: flex; flex-direction: column; padding: 20px; background: #0a0c0f; min-height: 100vh; }' +
                '.iptv-item { display: flex; align-items: center; padding: 12px; background: rgba(255,255,255,0.05); margin-bottom: 8px; border-radius: 8px; cursor: pointer; border: 2px solid transparent; }' +
                '.iptv-item.focus { background: #3498db !important; border-color: #fff; transform: scale(1.01); }' +
                '.iptv-item img { width: 60px; height: 35px; object-fit: contain; margin-right: 15px; background: #000; border-radius: 4px; }' +
                '.iptv-item .name { font-size: 1.2em; color: #fff; font-weight: 500; flex-shrink: 0; }' +
                '.iptv-item .epg { font-size: 0.9em; color: rgba(255,255,255,0.4); margin-left: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
                '</style>';
            if (!$('#tivi-style-classic').length) $('head').append('<div id="tivi-style-classic">' + style + '</div>');

            var url = Lampa.Storage.get('iptv_m3u_link', '');
            if (!url) {
                this.renderSettings();
            } else {
                this.load(url);
            }
        };

        this.load = function (url) {
            // Прямая загрузка без системного прокси, который вызывал ошибку
            $.ajax({
                url: url,
                method: 'GET',
                success: function (str) {
                    _this.parse(str);
                    _this.renderGroups();
                },
                error: function () {
                    // Если не вышло напрямую, используем резервный прокси
                    $.ajax({
                        url: 'https://corsproxy.io/?' + encodeURIComponent(url),
                        method: 'GET',
                        success: function (s) { _this.parse(s); _this.renderGroups(); },
                        error: function () { Lampa.Noty.show('Не удалось загрузить плейлист'); _this.renderSettings(); }
                    });
                }
            });
        };

        this.parse = function (str) {
            groups = { 'ВСЕ КАНАЛЫ': [] };
            var lines = str.split('\n');
            var cur = null;

            lines.forEach(function (l) {
                l = l.trim();
                if (l.indexOf('#EXTINF') === 0) {
                    var name = l.match(/,(.*)$/)?.[1] || 'Без названия';
                    var id = l.match(/tvg-id="([^"]+)"/i)?.[1] || '';
                    var logo = l.match(/tvg-logo="([^"]+)"/i)?.[1] || '';
                    if (!logo && id) logo = 'https://iptvx.one/logo/' + id + '.png';

                    cur = {
                        name: name,
                        id: id,
                        logo: logo,
                        group: l.match(/group-title="([^"]+)"/i)?.[1] || 'ОБЩИЕ'
                    };
                } else if (l.indexOf('http') === 0 && cur) {
                    cur.url = l;
                    if (!groups[cur.group]) groups[cur.group] = [];
                    groups[cur.group].push(cur);
                    groups['ВСЕ КАНАЛЫ'].push(cur);
                    cur = null;
                }
            });
        };

        this.renderGroups = function () {
            items.empty();
            this.addBtn('⚙️ НАСТРОЙКИ ПЛЕЙЛИСТА', function () { _this.renderSettings(); });

            Object.keys(groups).sort().forEach(function (g) {
                _this.addBtn('📁 ' + g.toUpperCase(), function () { _this.renderList(groups[g]); });
            });
            this.focus();
        };

        this.renderList = function (list) {
            items.empty();
            this.addBtn('🔙 НАЗАД В МЕНЮ', function () { _this.renderGroups(); });

            list.forEach(function (chan) {
                var epg_text = 'Программа загружается...';
                try {
                    if (window.Lampa && Lampa.TV) {
                        var data = Lampa.TV.getEPG(chan.id || chan.name);
                        if (data && data.current) epg_text = data.current.title;
                        else epg_text = 'Программа временно недоступна';
                    }
                } catch(e) { epg_text = ''; }

                var row = $('<div class="selector iptv-item">' +
                    '<img src="' + chan.logo + '" onerror="this.src=\'https://bylampa.github.io/img/iptv.png\'">' +
                    '<div class="name">' + chan.name + '</div>' +
                    '<div class="epg">' + epg_text + '</div>' +
                '</div>');

                row.on('hover:enter', function () {
                    Lampa.Player.play({ url: chan.url, title: chan.name });
                });

                items.append(row);
            });
            this.focus();
        };

        this.addBtn = function (name, action) {
            var btn = $('<div class="selector iptv-item"><div class="name">' + name + '</div></div>');
            btn.on('hover:enter', action);
            items.append(btn);
        };

        this.renderSettings = function () {
            Lampa.Input.edit({
                value: Lampa.Storage.get('iptv_m3u_link', ''),
                title: 'Введите ссылку на плейлист',
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
            var first = items.find('.selector').first();
            if (first.length) {
                Lampa.Controller.focus(first[0]);
            }
        };

        this.render = function () { return items; };
        this.start = function () { this.focus(); };
        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () { items.remove(); };
    }

    function init() {
        Lampa.Component.add('iptv_lite', IPTVComponent);
        var btn = $('<li class="menu__item selector" data-action="iptv_lite">' +
            '<div class="menu__ico"><svg height="22" viewBox="0 0 24 24" width="22" xmlns="http://www.w3.org/2000/svg"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 15c0-1.66 1.34-3 3-3 .35 0 .69.07 1 .18V6h5v2h-3v7.03A3.003 3.003 0 0 1 8 15z" fill="currentColor"/></svg></div>' +
            '<div class="menu__text">TiviMate</div>' +
            '</li>');

        btn.on('hover:enter', function () {
            Lampa.Activity.push({ title: 'TiviMate', component: 'iptv_lite', page: 1 });
        });
        $('.menu .menu__list').append(btn);
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') init(); });
})();
