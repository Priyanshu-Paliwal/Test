const fs = require('fs');

let file = 'public/js/customActivity.js';
let code = fs.readFileSync(file, 'utf8');

// Replace .hide() with .addClass('hidden-display').removeClass('block-display')
code = code.replace(/\.hide\(\)/g, '.addClass(\'hidden-display\').removeClass(\'block-display\')');

// Replace .show() with .removeClass('hidden-display').addClass('block-display')
code = code.replace(/\.show\(\)/g, '.removeClass(\'hidden-display\').addClass(\'block-display\')');

// Replace .css('display', 'none') with .addClass('hidden-display').removeClass('block-display')
code = code.replace(/\.css\(['"]display['"]\s*,\s*['"]none['"]\)/g, '.addClass(\'hidden-display\').removeClass(\'block-display\')');

// Replace .css('color', 'red') with .addClass('text-danger')
code = code.replace(/\.css\(['"]color['"]\s*,\s*['"]red['"]\)/g, '.addClass(\'text-danger\')');

// Fix any chained errors
fs.writeFileSync(file, code);

// eslint-disable-next-line no-console
console.log('customActivity.js fixed!');
