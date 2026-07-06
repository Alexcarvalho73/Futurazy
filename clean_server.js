const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');
code = code.replace(/(st\.intercompany = \(s1\.intercompany \|\| 0\) \+ \(s2\.intercompany \|\| 0\);\n\s*)+/g, 'st.intercompany = (s1.intercompany || 0) + (s2.intercompany || 0);\n          ');
code = code.replace(/(st\.intercompanyUsd = \(s1\.intercompanyUsd \|\| 0\) \+ \(s2\.intercompanyUsd \|\| 0\);\n\s*)+/g, 'st.intercompanyUsd = (s1.intercompanyUsd || 0) + (s2.intercompanyUsd || 0);\n          ');
fs.writeFileSync('server.js', code);
