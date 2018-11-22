
REM RMDIR node_modules /S /Q
REM npm install pug
REM node patchmodule node_modules\pug\lib\index.js
REM node patchmodule node_modules\pug-load\index.js
REM node patchmodule node_modules\pug-runtime\index.js	
REM node patchmodule node_modules/uglify-js/tools/node.js
REM npm install usb
REM node patchmodule node_modules\node-pre-gyp\lib\pre-binding.js
REM npm install pcsclite
REM node patchmodule node_modules\bindings\bindings.js
DEL app.zip
..\EFRbuild\7-zip\7z -tzip -mcu a app.zip *.* -r
REN node_modules ori_modules