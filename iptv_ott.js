(function () {
    'use strict';

    function IPTVComponent(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({mask: true, over: true});
        var items = $('<div class="category-full"></div>');
        var groups = {};

        this.create = function () {
            var url = Lampa.Storage.get('iptv_m3u_link', '');
            if (!url) {
                this.renderInputPage();
            } else {
                this.loadPlaylist(url);
            }
            scroll.append(items);
        };

        // Рисуем страницу с полем ввода
        this.renderInputPage = function() {
            var _this = this;
            items.empty();
            
            var ui = $(
                '<div style="text-align:center; padding:40px;">' +
                    '<div style="font-size:1.5em; margin-bottom:20px;">Настройка плейлиста</div>' +
                    '<div class="iptv-input-wrapper" style="max-width:500px; margin:0 auto;">' +
                        '<input type="text" id="iptv_url_field" class="selector" style="width:100%; padding:15px; background:rgba(255,255,255,0.1); border:none; border-radius:10px; color:#fff; margin-bottom:20px; text-align:center;" placeholder="Вставьте ссылку на M3U здесь...">' +
                        '<div class="selector iptv-save-btn" style="background:#fff; color:#000; padding:15px 40px; border-radius:30px; display:inline-block; font-weight:bold;">Сохранить и загрузить</div>' +
                    '</div>' +
                '</div>'
            );

            ui.find('.iptv-save-btn').on('hover:enter', function() {
                var val = ui.find('#iptv_url_field').val();
                if(val && val.length > 10) {
                    Lampa.Storage.set('iptv_m3u_link', val);
                    _this.loadPlaylist(val);
                } else {
                    Lampa.Noty.show('Ссылка слишком короткая или пустая');
                }
            });

            // Позволяем вызвать экранную клавиатуру при клике на само поле
            ui.find('#iptv_url_field').on('hover:enter', function() {
                var el = $(this);
                Lampa.Input.edit({
                    value: el.val(),
                    free: true
                }, function(new_val) {
                    if(new_val) el.val(new_val);
                });
            });

            items.append(ui);
            Lampa.Controller.enable('content');
        };

        this.loadPlaylist = function(url) {
            var _this = this;
            Lampa.Loading.show();
            network.silent(url, function (str) {
                Lampa.Loading.hide();
                _this.parse(str);
                _this.renderGroups();
            }, function () {
                Lampa.Loading.hide();
                Lampa.Noty.show('Ошибка загрузки. Проверьте CORS или ссылку.');
                _this.renderInputPage();
            }, false, {dataType: 'text'});
        };

        this.render = function () { return scroll.render(); };

        this.parse = function (str) {
            groups = {'Все каналы': []};
            var lines = str.split('\n');
            var current = null;
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (line.indexOf('#EXTINF') === 0) {
                    current = {};
                    var name = line.match(/,(.*)$/);
                    var group = line.match(/group-title="([^"]+)"/);
                    current.name = name ? name[1].trim() : 'Канал';
                    current.group = group ? group[1] : 'Разное';
                } else if (line.indexOf('http') === 0 && current) {
                    current.url = line;
                    if (!groups[current.group]) groups[current.group] = [];
                    groups[current.group].push(current);
                    groups['Все каналы'].push(current);
                    current = null;
                }
            }
        };

        this.renderGroups = function () {
            var _this = this;
            items.empty();
            
            var reset = Lampa.Template.get('button_category', {title: '⚙️ Сменить плейлист'});
            reset.on('hover:enter', function() { _this.renderInputPage(); });
            items.append(reset);

            Object.keys(groups).forEach(function (gName) {
                if (gName === 'Все каналы' && Object.keys(groups).length > 2) return;
                var card = Lampa.Template.get('button_category', {title: gName + ' (' + groups[gName].length + ')'});
                card.on('hover:enter', function () { _this.renderChannels(gName); });
                items.append(card);
            });
            Lampa.Controller.enable('content');
        };

        this.renderChannels = function (gName) {
            var _this = this;
            items.empty();
            var back = Lampa.Template.get('button_category', {title: '[ Назад ]'});
            back.on('hover:enter', function () { _this.renderGroups(); });
            items.append(back);

            groups[gName].forEach(function (chan) {
                var card = Lampa.Template.get('button_category', {title: chan.name});
                card.on('hover:enter', function () {
                    Lampa.Player.play({ url: chan.url, title: chan.name });
                    Lampa.Player.playlist([{ url: chan.url, title: chan.name }]);
                });
                items.append(card);
            });
            Lampa.Controller.enable('content');
        };

        this.pause = function () {};
        this.stop = function () {};
        this.start = function () {};
        this.destroy = function () { network.clear(); scroll.destroy(); items.remove(); };
    }

    function init() {
        Lampa.Component.add('iptv_lite', IPTVComponent);
        var item = $('<li class="menu__item selector" data-action="iptv_lite"><div class="menu__ico"><svg height="22" viewBox="0 0 24 24" width="22" xmlns="http://www.w3.org/2000/svg"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 15c0-1.66 1.34-3 3-3 .35 0 .69.07 1 .18V6h5v2h-3v7.03A3.003 3.003 0 0 1 8 15z" fill="currentColor"/></svg></div><div class="menu__text">IPTV Lite</div></li>');
        item.on('hover:enter', function () {
            Lampa.Activity.push({ title: 'IPTV Lite', component: 'iptv_lite', page: 1 });
        });
        $('.menu .menu__list').append(item);
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') init(); });
})();
