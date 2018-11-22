// patchmodule.js
// ==============================================================================================
// loadzip node module patch tool
// enables additional read file access into application .zip container
'use strict'
const FS = require('fs')

var file = process.argv[2]
var code = FS.readFileSync(file, 'utf8')
var code2 = code.replace(/\brequire\(\s*['"]fs['"]\s*\)/g, function (match, index) { 
    if (code[index + match.length] != ')') match = "(global.$ZFS||require('fs'))"
    return match
})
if (code2 != code) {
    try { FS.unlinkSync(file + '.loadzip') } catch (e) { }
    FS.renameSync(file, file + '.loadzip')
    FS.writeFileSync(file, code2)
} else {
    console.log('patchmodule', '#NOMATCH', file)
}
