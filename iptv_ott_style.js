(function () {
    'use strict';
    if (!window.Lampa) return;

/* ========= STORAGE ========= */

    const KEY = 'iptv_ott';
    let cfg = Lampa.Storage.get(KEY, {
        playlist: '',
        epg: ''
    });

    function save() {
        Lampa.Storage.set(KEY, cfg);
    }

/* ========= SETTINGS ========= */

    Lampa.Settings.add({
        title: 'IPTV (Ott style)',
        component: 'iptv_ott_settings'
    });

    Lampa.Component.add('iptv_ott_settings', {
        template: `
        <div class="settings">
            <div class="settings__item selector" data-t="playlist">
                URL плейлиста
                <div class="settings__value">${cfg.playlist || 'не задан'}</div>
            </div>
            <div class="settings__item selector" data-t="epg">
                URL EPG
                <div class="settings__value">${cfg.epg || 'не задан'}</div>
            </div>
        </div>
        `,
        start() {
            this.render().find('.settings__item').on('click', e => {
                let t = e.currentTarget.dataset.t;

                Lampa.Input.edit({
                    title: t === 'playlist' ? 'URL M3U' : 'URL EPG',
                    value: cfg[t],
                    onBack: v => { cfg[t] = v; save(); }
                });
            });

            Lampa.Controller.enable('content');
        }
    });

/* ========= LOAD ========= */

    Lampa.Settings.add({
        title: 'IPTV (просмотр)',
        onClick() {
            if (!cfg.playlist) {
                Lampa.Noty.show('Укажи плейлист');
                return;
            }

            Lampa.Request.get(cfg.playlist, parseM3U);
        }
    });

/* ========= M3U ========= */

    function parseM3U(txt) {
        let lines = txt.split('\n');
        let list = [];
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
                list.push(cur);
                cur = null;
            }
        });

        openUI(list);
    }

/* ========= UI ========= */

    function openUI(data) {
        Lampa.Activity.push({
            component: 'iptv_ott',
            title: 'IPTV',
            data
        });
    }

    Lampa.Component.add('iptv_ott', {
        template: `
        <div class="iptv">
            <div class="iptv-groups"></div>
            <div class="iptv-channels"></div>
        </div>
        `,
        start() {
            let root = this.render();
            let gbox = root.find('.iptv-groups');
            let cbox = root.find('.iptv-channels');

            let groups = {};
            this.params.data.forEach(c => {
                if (!groups[c.group]) groups[c.group] = [];
                groups[c.group].push(c);
            });

            Object.keys(groups).forEach(g => {
                let gi = $(`<div class="selector">${g}</div>`);
                gi.on('click', () => render(groups[g]));
                gbox.append(gi);
            });

            function render(list) {
                cbox.empty();
                list.forEach(ch => {
                    let ci = $(`
                        <div class="selector">
                            <img src="${ch.logo || ''}">
                            <span>${ch.title}</span>
                        </div>
                    `);

                    ci.on('click', () => {
                        Lampa.Player.play({
                            title: ch.title,
                            url: ch.url,
                            type: 'tv',
                            epg: cfg.epg || null,
                            epg_id: ch.epg || null
                        });
                    });

                    cbox.append(ci);
                });
            }

            render(groups[Object.keys(groups)[0]]);
            Lampa.Controller.enable('content');
        }
    });

})();
