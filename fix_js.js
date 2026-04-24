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

// Option B replacements from Senior Dev Manager
code = code.replace(/\.css\(['"]border['"]\s*,\s*['"]1px solid red['"]\)/g, '.addClass(\'error-border\')');
code = code.replace(/\.css\(['"]border['"]\s*,\s*['"]['"]\)/g, '.removeClass(\'error-border\')');
code = code.replace(/\.css\(['"]display['"]\s*,\s*['"]block['"]\)/g, '.removeClass(\'hidden-display\').addClass(\'block-display\')');
code = code.replace(/\.css\(['"]display['"]\s*,\s*['"]inline-block['"]\)/g, '.removeClass(\'hidden-display\').addClass(\'inline-block-display\')');
code = code.replace(/\.css\(['"]color['"]\s*,\s*['"](?:gray|grey)['"]\)/g, '.addClass(\'text-muted\')');
code = code.replace(/\.css\(['"]color['"]\s*,\s*['"]black['"]\)/g, '.removeClass(\'text-muted\')');

// Awkward case 1: $('body').css('overflow', '');
code = code.replace(/\$\(['"]body['"]\)\.css\(['"]overflow['"]\s*,\s*['"]['"]\);/g, '');

// Awkward case 2: Dynamic color toggle
code = code.replace(/let color = extraService\.val\(\) === ['"]Select Extra Service['"] \? ['"]gray['"] : ['"]black['"]\s*;/g, 'let isDisabled = extraService.val() === \'Select Extra Service\';');
code = code.replace(/extraService\.prop\(['"]disabled['"], false\)\.css\(['"]color['"],\s*color\);/g, 'extraService.prop(\'disabled\', false).toggleClass(\'text-muted\', isDisabled);');

// Fix any chained errors
fs.writeFileSync(file, code);

// eslint-disable-next-line no-console
console.log('customActivity.js fixed!');
