## Release Checklist

#### Update version, docs, tag, and publish
- [ ] git checkout main
- [ ] npm install && npm run test
- [ ] Update `CHANGELOG.md`
- [ ] Update version number in `package.json`
- [ ] git add .
- [ ] git commit -m 'vA.B.C'
- [ ] git tag vA.B.C
- [ ] git push origin main vA.B.C
- [ ] npm publish
