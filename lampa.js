(function () {
    'use strict';
    if (!window.Lampa) return;

/* =========================
   CONFIG / STORAGE
========================= */

    const STORAGE = 'iptv_ott';
    let cfg = Lampa.Storage.get(STORAGE, {
        playlist_url: '',
        epg_url: '',
        last_channel: null
    });

    function save() {
        Lampa.Storage.set(STORAGE, cfg);
    }

/* =========================
   SETTINGS UI
========================= */

    Lampa.Settings.add({
        title: 'IPTV (Ott style)',
        component: 'iptv_ott_settings'
    });

    Lampa.Component.add('iptv_ott_settings', {
        template: `
        <div class="settings">
            <div class="settings__item selector" data-type="playlist">
                URL плейлиста
                <div class="settings__value">${cfg.playlist_url || 'не задан'}</div>
            </div>
            <div class="settings__item selector" data-type="file">
                Загрузить M3U файл
            </div>
            <div class="settings__item selector" data-type="epg">
                URL EPG (xmltv)
                <div class="settings__value">${cfg.epg_url || 'не задан'}</div>
            </div>
        </div>
        `,
        start() {
            this.render().find('.settings__item').on('click', e => {
                let type = e.currentTarget.dataset.type;

                if (type === 'playlist') {
                    Lampa.Input.edit({
                        title: 'URL M3U',
                        value: cfg.playlist_url,
                        onBack: v => { cfg.playlist_url = v; save(); }
                    });
                }

                if (type === 'epg') {
                    Lampa.Input.edit({
                        title: 'URL EPG',
                        value: cfg.epg_url,
                        onBack: v => { cfg.epg_url = v; save(); }
                    });
                }

                if (type === 'file') {
                    Lampa.Platform.openFile(file => {
                        let r = new FileReader();
                        r.onload = e => parseM3U(e.target.result);
                        r.readAsText(file);
                    });
                }
            });

            Lampa.Controller.enable('content');
        }
    });

/* =========================
   LOAD PLAYLIST
========================= */

    function loadPlaylist() {
        if (!cfg.playlist_url) {
            Lampa.Noty.show('Укажи плейлист');
            return;
        }
        Lampa.Request.get(cfg.playlist_url, parseM3U);
    }

    Lampa.Settings.add({
        title: 'IPTV (просмотр)',
        onClick: loadPlaylist
    });

/* =========================
   M3U PARSER
========================= */

    function parseM3U(text) {
        let lines = text.split('\n');
        let channels = [];
        let cur = null;

        lines.forEach(l => {
            l = l.trim();

            if (l.startsWith('#EXTINF')) {
                cur = {
                    title: l.split(',').pop(),
                    group: (l.match(/group-title="(.*?)"/) || [,'Без группы'])[1],
                    logo: (l.match(/tvg-logo="(.*?)"/) || [,''])[1],
                    epg:  (l.match(/tvg-id="(.*?)"/) || [,''])[1],
                    url: ''
                };
            } else if (l && !l.startsWith('#') && cur) {
                cur.url = l;
                channels.push(cur);
                cur = null;
            }
        });

        openIPTV(channels);
    }

/* =========================
   IPTV MAIN UI (OTT STYLE)
========================= */

    function openIPTV(channels) {
        Lampa.Activity.push({
            component: 'iptv_ott',
            title: 'IPTV',
            data: channels
        });
    }

    Lampa.Component.add('iptv_ott', {
        template: `
        <div class="iptv-ott">
            <div class="iptv-left"></div>
            <div class="iptv-center"></div>
            <div class="iptv-right"></div>
        </div>
        `,
        start() {
            let root = this.render();
            let left = root.find('.iptv-left');
            let center = root.find('.iptv-center');
            let right = root.find('.iptv-right');

            let groups = {};
            this.params.data.forEach(c => {
                if (!groups[c.group]) groups[c.group] = [];
                groups[c.group].push(c);
            });

            /* GROUPS */
            Object.keys(groups).forEach(g => {
                let item = $(`<div class="selector iptv-group">${g}</div>`);
                item.on('click', () => renderChannels(groups[g]));
                left.append(item);
            });

            function renderChannels(list) {
                center.empty();
                list.forEach(ch => {
                    let c = $(`
                        <div class="selector iptv-channel">
                            <img src="${ch.logo || ''}">
                            <span>${ch.title}</span>
                        </div>
                    `);
                    c.on('click', () => play(ch));
                    c.on('hover:focus', () => renderEPG(ch));
                    center.append(c);
                });
            }

            function play(ch) {
                cfg.last_channel = ch;
                save();

                Lampa.Player.play({
                    title: ch.title,
                    url: ch.url,
                    type: 'tv',
                    epg: cfg.epg_url,
                    epg_id: ch.epg
                });
            }

            function renderEPG(ch) {
                right.empty().append(`<div class="iptv-epg-title">${ch.title}</div>`);
                if (!cfg.epg_url || !ch.epg) return;

                Lampa.EPG.get(cfg.epg_url, ch.epg, list => {
                    list.slice(0, 5).forEach(p => {
                        right.append(`
                            <div class="iptv-epg-item">
                                <div>${p.start} – ${p.end}</div>
                                <div>${p.title}</div>
                            </div>
                        `);
                    });
                });
            }

            renderChannels(groups[Object.keys(groups)[0]]);
            Lampa.Controller.enable('content');
        }
    });

})();