'use strict';
// Spreadsheet plugin tools — runs in the Genie plugin worker. Generates an .xlsx
// with @particle-academy/holy-sheet and writes it via the guarded fs bridge.
var Agent = require('@particle-academy/holy-sheet').Agent;
var NL = String.fromCharCode(10);

function slugify(s) {
    var v = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return v || 'workbook';
}

function outPath(input, title) {
    var p = (typeof input.path === 'string' && input.path.trim()) ? input.path.trim() : slugify(title) + '.xlsx';
    var low = p.toLowerCase();
    if (!(low.endsWith('.xlsx') || low.endsWith('.csv') || low.endsWith('.ods'))) p = p + '.xlsx';
    return p;
}

function normaliseSheet(raw, i) {
    var s = (raw && typeof raw === 'object') ? raw : {};
    return {
        name: (typeof s.name === 'string' && s.name.trim()) ? s.name.trim() : ('Sheet' + (i + 1)),
        columns: Array.isArray(s.columns) ? s.columns : undefined,
        rows: Array.isArray(s.rows) ? s.rows : [],
        theme: (typeof s.theme === 'string') ? s.theme : undefined,
        totals: (s.totals && typeof s.totals === 'object') ? s.totals : undefined
    };
}

async function createWorkbook(args, bridge) {
    var input = (args && typeof args === 'object') ? args : {};
    var schema;
    if (Array.isArray(input.sheets) && input.sheets.length) {
        schema = { sheets: input.sheets.map(normaliseSheet) };
    } else if (Array.isArray(input.rows)) {
        schema = Agent.fromArray(input.rows, Array.isArray(input.headers) ? input.headers : null, (typeof input.sheetName === 'string' && input.sheetName) ? input.sheetName : 'Sheet1');
    } else if (typeof input.csv === 'string') {
        schema = Agent.fromCsv(input.csv);
    } else {
        schema = { sheets: [{ name: (typeof input.sheetName === 'string' && input.sheetName) ? input.sheetName : 'Sheet1', columns: [], rows: [] }] };
    }

    var errors = Agent.validate(schema);
    if (errors && errors.length) {
        var rep = Agent.validateAndRepair(schema);
        if (rep && rep.schema) schema = rep.schema;
        var stillBad = Agent.validate(schema);
        if (stillBad && stillBad.length) {
            return { isError: true, content: [{ type: 'text', text: 'Workbook did not validate:' + NL + errors.map(function (e) { return '- ' + e.path + ': ' + e.hint; }).join(NL) }] };
        }
    }

    var bytes = Agent.toBytes(schema);
    var title = (typeof input.title === 'string' && input.title) ? input.title : 'workbook';
    var rel = outPath(input, title);
    var res = await bridge.fs.writeBytes(rel, bytes);
    var count = Array.isArray(schema.sheets) ? schema.sheets.length : 1;
    return { content: [{ type: 'text', text: 'Created ' + res.relPath + ' (' + count + ' sheet(s), ' + res.bytes + ' bytes). Open it in Genie to view.' }] };
}

module.exports = { createWorkbook: createWorkbook };
