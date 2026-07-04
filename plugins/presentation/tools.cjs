'use strict';
// Presentation plugin tools — runs in the Genie plugin worker. Generates a .pptx
// with @particle-academy/dark-slide and writes it via the capability-scoped,
// guard-resolved, extension-limited fs bridge (never a raw filesystem write).
var Agent = require('@particle-academy/dark-slide').Agent;
var NL = String.fromCharCode(10);

function slugify(s) {
    var v = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return v || 'deck';
}

function outPath(input, title) {
    var p = (typeof input.path === 'string' && input.path.trim()) ? input.path.trim() : slugify(title) + '.pptx';
    var low = p.toLowerCase();
    if (!(low.endsWith('.pptx') || low.endsWith('.odp'))) p = p + '.pptx';
    return p;
}

function textEl(id, content, x, y, w, h, style) {
    return { id: id, type: 'text', x: x, y: y, w: w, h: h, content: String(content == null ? '' : content), format: 'markdown', style: style || {} };
}

function buildSlide(raw, i) {
    var s = (raw && typeof raw === 'object') ? raw : {};
    var elements = [];
    var title = (typeof s.title === 'string') ? s.title : '';
    if (title) elements.push(textEl('s' + i + '-title', '# ' + title, 0.06, 0.07, 0.88, 0.18, { fontSize: 40, fontWeight: 700 }));
    var body = (typeof s.body === 'string') ? s.body : '';
    if (!body && Array.isArray(s.bullets)) body = s.bullets.map(function (b) { return '- ' + String(b); }).join(NL);
    if (body) elements.push(textEl('s' + i + '-body', body, 0.06, 0.30, 0.88, 0.62, { fontSize: 22 }));
    if (elements.length === 0) elements.push(textEl('s' + i + '-empty', '', 0.06, 0.30, 0.88, 0.40));
    return { id: 'slide-' + (i + 1), layout: (typeof s.layout === 'string') ? s.layout : 'title-content', elements: elements };
}

async function createDeck(args, bridge) {
    var input = (args && typeof args === 'object') ? args : {};
    var title = (typeof input.title === 'string' && input.title.trim()) ? input.title.trim() : 'Untitled deck';
    var slidesIn = Array.isArray(input.slides) ? input.slides : [];
    var deck = {
        id: 'deck-' + Date.now(),
        title: title,
        theme: { name: (typeof input.theme === 'string' && input.theme.trim()) ? input.theme.trim() : 'default' },
        slides: slidesIn.map(buildSlide)
    };
    if (deck.slides.length === 0) deck.slides.push(buildSlide({ title: title }, 0));

    var errors = Agent.validate(deck);
    if (errors && errors.length) {
        var rep = Agent.validateAndRepair(deck);
        if (!rep.ok) {
            return { isError: true, content: [{ type: 'text', text: 'Deck did not validate:' + NL + errors.map(function (e) { return '- ' + e.path + ': ' + e.hint; }).join(NL) }] };
        }
    }

    var bytes = Agent.toBytes(deck);
    var rel = outPath(input, title);
    var res = await bridge.fs.writeBytes(rel, bytes);
    return { content: [{ type: 'text', text: 'Created ' + res.relPath + ' (' + deck.slides.length + ' slide(s), ' + res.bytes + ' bytes). Open it in Genie to view.' }] };
}

module.exports = { createDeck: createDeck };
