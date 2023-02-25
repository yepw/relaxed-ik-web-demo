## A Web Demo of Relaxed-IK
[Online Demo](https://yepw.github.io/relaxed-ik-web-demo/)
### Usage
```
git submodule init --recursive
git submodule update --recursive
cd relaxed_ik_web 
wasm-pack build --target web
npm install
npm run build
```
The built files are under `dist/`.

### Deploy to Github Pages

Update `homepage` tag in `package.json`
```
npm run deploy
```
