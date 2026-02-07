// ==Lampa==
// name: IPTV Stable Base (Lampac Safe)
// version: 9.0.0
// author: Artrax90
// ==/Lampa==

(function () {
    'use strict';

    var PLAYLIST_URL = 'https://raw.githubusercontent.com/loganettv/playlists/refs/heads/main/mega.m3u';

    function IPTV() {
        var html = $('<div class="iptv-wrap"></div>');
        var list = $('<div class="iptv-list"></div>');
        html.append(list);

        var items = [];
        var index = 0;

        $('head').append(
            '<style>' +
            '.iptv-wrap{padding:20px}' +
            '.iptv-item{padding:14px;margin-bottom:8px;background:#1a1d22;border-radius:10px}' +
            '.iptv-item.focus{background:#2962ff}' +
            '</style>'
        );

        this.create = function () {
            load();
        };

        this.render = function () {
            return html;
        };

        this.start = function () {
            Lampa.Controller.enable('content');
            focus();
        };

        this.destroy = function () {};

        function load() {
            $.get(PLAYLIST_URL, parse);
        }

        function parse(text) {
            items = [];
            list.empty();

            var lines = text.split('\n');
            var cur = null;

            for (var i = 0; i < lines.length; i++) {
                var l = lines[i].trim();

                if (l.indexOf('#EXTINF') === 0) {
                    cur = { name: l.split(',')[1] || '' };
                }
                else if (l.indexOf('http') === 0 && cur) {
                    cur.url = l;
                    items.push(cur);

                    list.append('<div class="iptv-item selector">' + cur.name + '</div>');
                    cur = null;
                }
            }

            focus();
        }

        function focus() {
            var els = list.find('.selector');
            els.removeClass('focus');
            if (els[index]) $(els[index]).addClass('focus');
        }

        Lampa.Controller.add('iptv', {
            up: function () {
                if (index > 0) index--;
                focus();
            },
            down: function () {
                if (index < items.length - 1) index++;
                focus();
            },
            enter: function () {
                var c = items[index];
                if (!c) return;
                Lampa.Player.play({
                    url: c.url,
                    title: c.name,
                    type: 'tv'
                });
            },
            back: function () {
                Lampa.Activity.backward();
            }
        });
    }

    function init() {
        Lampa.Component.add('iptv', IPTV);

        $('.menu .menu__list').append(
            $('<li class="menu__item selector"><div class="menu__text">IPTV</div></li>')
                .on('hover:enter', function () {
                    Lampa.Activity.push({
                        title: 'IPTV',
                        component: 'iptv'
                    });
                })
        );
    }

    if (window.app_ready) init();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }
})();
