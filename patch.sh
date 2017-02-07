#!/bin/bash
cd dist
for js in *.js
do
    perl -pe "s|System.register\('(.*?)', |System.register\(|g" < $js >$js+ && mv $js+ $js
    perl -pe "s|System.register\(\"(.*?)\", |System.register\(|g" < $js >$js+ && mv $js+ $js
    perl -pe "s|System.registerDynamic\(\"node_modules/chronoshift/lib/walltime/index.js\"|System.registerDynamic\(\"../lib/walltime\"|g" < $js >$js+ && mv $js+ $js
done


