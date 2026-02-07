// ==Lampa==
// name: IPTV TiviMate Stable
// version: 2.1.0
// description: Stable IPTV plugin (TiviMate-like UI, favorites, safe EPG)
// author: Artrax90
// ==/Lampa==

(function () {
    'use strict';
    if (!window.Lampa) return;

    Lampa.Extensions.add({
        name: 'iptv_tivimate_stable',
        version: '2.1.0',

        init: function () {
            console.log('[IPTV TiviMate STABLE] init');

            const KEY_CFG = 'iptv_tm_cfg';
            const KEY_FAV = 'iptv_tm_fav';

            let cfg = Lampa.Storage.get(KEY_CFG, {
                playlist: '',
                epg: ''
            });

            let favorites = Lampa.Storage.get(KEY_FAV, []);

            const saveCfg = () => Lampa.Storage.set(KEY_CFG, cfg);
            const saveFav = () => Lampa.Storage.set(KEY_FAV, favorites);

            let groups = {};
            let channels = [];

            /* ====================== STYLES ====================== */

            if (!document.getElementById('iptv-tm-style')) {
                let style = document.createElement('style');
                style.id = 'iptv-tm-style';
                style.innerHTML = `
                .tm-root{display:flex;height:100vh;background:#050607;color:#fff;font-family:Roboto,Arial}
                .tm-groups{width:260px;background:#0b0d10;padding:14px;overflow:auto}
                .tm-group{padding:14px;border-radius:10px;margin-bottom:8px;background:#15181d}
                .tm-group.focus{background:#2962ff}
                .tm-channels{flex:1;padding:18px;overflow:auto}
                .tm-channel{display:flex;align-items:center;padding:14px;border-radius:12px;margin-bottom:10px;background:#12151a}
                .tm-channel.focus{background:#1e232b}
                .tm-channel img{width:64px;height:36px;background:#000;border-radius:6px;margin-right:14px}
                .tm-name{font-size:1.1em;flex:1}
                .tm-epg{opacity:.6;font-size:.9em;max-width:40%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
                .tm-fav{color:#ffcc00;margin-right:10px}
                .tm-empty{opacity:.6;padding:20px}
                `;
                document.head.appendChild(style);
            }

            /* ====================== SETTINGS ====================== */

            Lampa.Settings.add({
                title: 'IPTV TiviMate',
                component: 'iptv_tm_settings'
            });

            Lampa.Component.add('iptv_tm_settings', {
                template: `
                    <div class="settings">
                        <div class="settings__item selector" data-t="playlist">
                            M3U плейлист
                            <div class="settings__value">${cfg.playlist || 'не задан'}</div>
                        </div>
                        <div class="settings__item selector" data-t="epg">
                            EPG (xmltv, опционально)
                            <div class="settings__value">${cfg.epg || 'не задан'}</div>
                        </div>
                    </div>
                `,
                start: function () {
                    this.render().find('.settings__item').on('click', function () {
                        let t = this.dataset.t;
                        Lampa.Input.edit({
                            title: t === 'playlist' ? 'URL M3U плейлиста' : 'URL EPG',
                            value: cfg[t],
                            onBack: function (v) {
                                cfg[t] = v;
                                saveCfg();
                            }
                        });
                    });
                    Lampa.Controller.enable('content');
                }
            });

            /* ====================== ENTRY ====================== */

            Lampa.Settings.add({
                title: 'IPTV (TiviMate)',
                onClick: function () {
                    if (!cfg.playlist) {
                        Lampa.Noty.show('Укажи M3U плейлист');
                        return;
                    }
                    Lampa.Request.get(cfg.playlist, parseM3U);
                }
            });

            /* ====================== M3U PARSER ====================== */

            function parseM3U(text) {
                groups = { '⭐ Избранное': [] };
                channels = [];

                let cur = null;

                text.split('\n').forEach(function (l) {
                    l = l.trim();

                    if (l.indexOf('#EXTINF') === 0) {
                        cur = {
                            name: l.split(',').pop(),
                            group: (l.match(/group-title="([^"]+)"/) || [,'Общие'])[1],
                            logo: (l.match(/tvg-logo="([^"]+)"/) || [,''])[1],
                            id: (l.match(/tvg-id="([^"]+)"/) || [,''])[1],
                            url: ''
                        };
                    }
                    else if (l.startsWith('http') && cur) {
                        cur.url = l;
                        channels.push(cur);

                        if (!groups[cur.group]) groups[cur.group] = [];
                        groups[cur.group].push(cur);

                        if (favorites.includes(cur.name)) {
                            groups['⭐ Избранное'].push(cur);
                        }

                        cur = null;
                    }
                });

                openUI();
            }

            /* ====================== UI ====================== */

            function openUI() {
                Lampa.Activity.push({
                    title: 'IPTV',
                    component: 'iptv_tm',
                    data: {}
                });
            }

            Lampa.Component.add('iptv_tm', {
                template: `
                    <div class="tm-root">
                        <div class="tm-groups"></div>
                        <div class="tm-channels"></div>
                    </div>
                `,
                start: function () {
                    let root = this.render();
                    let gbox = root.find('.tm-groups')[0];
                    let cbox = root.find('.tm-channels')[0];

                    function drawGroups() {
                        gbox.innerHTML = '';
                        Object.keys(groups).forEach(function (g) {
                            let el = document.createElement('div');
                            el.className = 'selector tm-group';
                            el.textContent = g;
                            el.onclick = function () {
                                drawChannels(groups[g]);
                            };
                            gbox.appendChild(el);
                        });
                    }

                    function drawChannels(list) {
                        cbox.innerHTML = '';

                        if (!list || !list.length) {
                            let empty = document.createElement('div');
                            empty.className = 'tm-empty';
                            empty.textContent = 'Нет каналов';
                            cbox.appendChild(empty);
                            return;
                        }

                        list.forEach(function (ch) {
                            let el = document.createElement('div');
                            el.className = 'selector tm-channel';
                            el.innerHTML = `
                                <img src="${ch.logo}" onerror="this.style.display='none'">
                                <span class="tm-fav">${favorites.includes(ch.name) ? '★' : ''}</span>
                                <div class="tm-name">${ch.name}</div>
                                <div class="tm-epg">EPG через плеер</div>
                            `;

                            el.onclick = function () {
                                Lampa.Player.play({
                                    title: ch.name,
                                    url: ch.url,
                                    type: 'tv',
                                    epg: cfg.epg || null,
                                    epg_id: ch.id || null
                                });
                            };

                            el.onkeydown = function (e) {
                                if (e.keyCode === 13) { // OK
                                    if (favorites.includes(ch.name))
                                        favorites = favorites.filter(f => f !== ch.name);
                                    else
                                        favorites.push(ch.name);
                                    saveFav();
                                    drawGroups();
                                    drawChannels(list);
                                }
                            };

                            cbox.appendChild(el);
                        });
                    }

                    drawGroups();
                    drawChannels(groups[Object.keys(groups)[0]]);
                    Lampa.Controller.enable('content');
                }
            });
        }
    });

})();
