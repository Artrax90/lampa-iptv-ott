// ==Lampa==
// name: IPTV PRO Final Fix
// version: 11.10
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent(object) {
        var _this = this;
        var root, colG, colC, colE;
        var groups_data = {};
        var all_channels = [];
        var current_list = [];
        var active_col = 'groups';
        var index_g = 0, index_c = 0;

        var storage_key = 'iptv_pro_v11';
        var config = Lampa.Storage.get(storage_key, {
            playlists: [
                { name: 'MEGA', url: 'https://raw.githubusercontent.com/loganettv/playlists/refs/heads/main/mega.m3u' }
            ],
            favorites: [],
            current_pl_index: 0
        });

        /* ================= CREATE ================= */

        this.create = function () {
            root = $('<div class="iptv-root"></div>');
            var container = $('<div class="iptv-wrapper"></div>');
            colG = $('<div class="iptv-col col-groups"></div>');
            colC = $('<div class="iptv-col col-channels"></div>');
            colE = $('<div class="iptv-col col-details"></div>');
            container.append(colG, colC, colE);
            root.append(container);

            if (!$('#iptv-v11-style').length) {
                $('head').append(
                    '<style id="iptv-v11-style">' +
                    '.iptv-root{position:fixed;inset:0;background:#0b0d10;z-index:1000;padding-top:5rem}' +
                    '.iptv-wrapper{display:flex;width:100%;height:100%}' +
                    '.iptv-col{height:100%;overflow-y:auto;background:rgba(0,0,0,0.2);border-right:1px solid rgba(255,255,255,0.1)}' +
                    '.col-groups{width:20rem}' +
                    '.col-channels{flex:1}' +
                    '.iptv-item{padding:1rem;margin:0.4rem;border-radius:0.5rem;background:rgba(255,255,255,0.03);color:#fff;cursor:pointer}' +
                    '.iptv-item.active{background:#2962ff!important}' +
                    '.iptv-item.fav{background:#ffb300!important;color:#000}' +
                    '.btn-pl,.btn-search{padding:1rem;margin:0.5rem 1rem;text-align:center;border-radius:0.5rem;cursor:pointer;color:#fff;font-weight:bold}' +
                    '.btn-pl{background:#2962ff}.btn-search{background:#444}' +
                    '</style>'
                );
            }

            this.loadPlaylist();
            return root;
        };

        /* ================= LOAD PLAYLIST ================= */

        this.loadPlaylist = function () {
            var current = config.playlists[config.current_pl_index];
            if (!current) return;

            $.ajax({
                url: current.url,
                success: function (str) { _this.parse(str); },
                error: function () { Lampa.Noty.show('Ошибка загрузки'); _this.parse(''); }
            });
        };

        /* ================= PARSE ================= */

        this.parse = function (str) {
            var lines = str.split('\n');
            groups_data = { '⭐ Избранное': config.favorites };
            all_channels = [];

            for (var i = 0; i < lines.length; i++) {
                var l = lines[i].trim();
                if (l.indexOf('#EXTINF') === 0) {
                    var n = (l.match(/,(.*)$/) || [,''])[1];
                    var g = (l.match(/group-title="([^"]+)"/i) || [,'ОБЩИЕ'])[1];
                    var url = lines[i + 1] ? lines[i + 1].trim() : '';
                    if (url.indexOf('http') === 0) {
                        var item = { name: n, url: url, group: g };
                        all_channels.push(item);
                        if (!groups_data[g]) groups_data[g] = [];
                        groups_data[g].push(item);
                    }
                }
            }
            this.renderG();
        };

        /* ================= FAVORITES ================= */

        function toggleFavorite(ch) {
            var i;
            for (i = 0; i < config.favorites.length; i++) {
                if (config.favorites[i].url === ch.url) {
                    config.favorites.splice(i, 1);
                    Lampa.Noty.show('Удалено из избранного');
                    Lampa.Storage.set(storage_key, config);
                    _this.renderG();
                    return;
                }
            }
            config.favorites.push(ch);
            Lampa.Noty.show('Добавлено в избранное');
            Lampa.Storage.set(storage_key, config);
            _this.renderG();
        }

        function isFavorite(ch) {
            for (var i = 0; i < config.favorites.length; i++) {
                if (config.favorites[i].url === ch.url) return true;
            }
            return false;
        }

        /* ================= GROUPS ================= */

        this.renderG = function () {
            colG.empty();

            var btnPl = $('<div class="btn-pl">📂 Плейлисты</div>');
            btnPl.on('click', function () { _this.playlistMenu(); });

            var btnSearch = $('<div class="btn-search">🔍 Поиск</div>');
            btnSearch.on('click', function () { _this.searchChannels(); });

            colG.append(btnPl, btnSearch);

            for (var g in groups_data) {
                (function (group) {
                    var item = $('<div class="iptv-item">' + group + '</div>');
                    item.on('click', function () {
                        active_col = 'groups';
                        _this.renderC(groups_data[group]);
                    });
                    colG.append(item);
                })(g);
            }

            this.updateFocus();
        };

        /* ================= SEARCH ================= */

        this.searchChannels = function () {
            Lampa.Input.edit({
                title: 'Поиск канала',
                value: '',
                free: true
            }, function (query) {
                if (!query) return;
                var q = query.toLowerCase();
                var filtered = [];
                for (var i = 0; i < all_channels.length; i++) {
                    if (all_channels[i].name.toLowerCase().indexOf(q) !== -1) {
                        filtered.push(all_channels[i]);
                    }
                }
                active_col = 'channels';
                index_c = 0;
                _this.renderC(filtered);
            });
        };

        /* ================= CHANNELS ================= */

        this.renderC = function (list) {
            colC.empty();
            current_list = list || [];

            for (var i = 0; i < current_list.length; i++) {
                (function (c) {
                    var row = $('<div class="iptv-item">' + c.name + '</div>');
                    if (isFavorite(c)) row.addClass('fav');

                    row.on('click', function () {
                        Lampa.Player.play({ url: c.url, title: c.name });
                    });

                    row.on('hover:hold', function () {
                        toggleFavorite(c);
                    });

                    colC.append(row);
                })(current_list[i]);
            }
            this.updateFocus();
        };

        /* ================= FOCUS ================= */

        this.updateFocus = function () {
            $('.iptv-item').removeClass('active');
            if (active_col === 'groups') colG.find('.iptv-item').eq(index_g).addClass('active');
            else colC.find('.iptv-item').eq(index_c).addClass('active');
        };

        /* ================= CONTROLLER ================= */

        this.start = function () {
            Lampa.Controller.add('iptv_pro', {
                up: function () {
                    if (active_col === 'groups') index_g = Math.max(0, index_g - 1);
                    else index_c = Math.max(0, index_c - 1);
                    _this.updateFocus();
                },
                down: function () {
                    if (active_col === 'groups') index_g = Math.min(colG.find('.iptv-item').length - 1, index_g + 1);
                    else index_c = Math.min(current_list.length - 1, index_c + 1);
                    _this.updateFocus();
                },
                right: function () {
                    if (active_col === 'groups') {
                        active_col = 'channels';
                        index_c = 0;
                        _this.renderC();
                    }
                },
                left: function () {
                    if (active_col === 'channels') active_col = 'groups';
                    else Lampa.Activity.back();
                    _this.updateFocus();
                },
                enter: function () {
                    if (active_col === 'groups') {
                        active_col = 'channels';
                        _this.renderC();
                    } else if (current_list[index_c]) {
                        Lampa.Player.play({
                            url: current_list[index_c].url,
                            title: current_list[index_c].name
                        });
                    }
                },
                hold: function () {
                    if (active_col === 'channels' && current_list[index_c]) {
                        toggleFavorite(current_list[index_c]);
                    }
                },
                back: function () { Lampa.Activity.back(); }
            });
            Lampa.Controller.toggle('iptv_pro');
        };

        this.render = function () { return root; };
        this.destroy = function () {
            Lampa.Controller.remove('iptv_pro');
            root.remove();
        };
    }

    function init() {
        Lampa.Component.add('iptv_pro', IPTVComponent);
        var item = $('<li class="menu__item selector"><div class="menu__text">IPTV PRO</div></li>');
        item.on('hover:enter', function () {
            Lampa.Activity.push({ title: 'IPTV', component: 'iptv_pro' });
        });
        $('.menu .menu__list').append(item);
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') init();
    });
})();
