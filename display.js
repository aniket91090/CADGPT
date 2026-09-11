import * as three from './node_modules/three/build/three.module.js';
import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';

const vp = document.getElementById('viewport');
vp.style.position = 'relative';

let w = vp.clientWidth;
let h = vp.clientHeight;

const scn = new three.Scene();
scn.background = new three.Color(0x4e4f5a);

const cam = new three.PerspectiveCamera(60, w/h, 0.1, 1000);
cam.position.set(15, 15, 15);
cam.lookAt(0, 0, 0);

const ren = new three.WebGLRenderer({ antialias: true });
ren.setSize(w, h);
ren.setPixelRatio(window.devicePixelRatio);

vp.appendChild(ren.domElement);

const ctrl = new OrbitControls(cam, ren.domElement);
ctrl.enableDamping = true;
ctrl.dampingFactor = 0.05;

const aml = new three.AmbientLight(0x555555);
scn.add(aml);

const dirl = new three.DirectionalLight(0xffffff, 0.8);
dirl.position.set(15, 30, 15);
scn.add(dirl);

const grid = new three.GridHelper(50, 20, 0x2e2f38, 0x3a3b45);
grid.position.y = -0.01;
scn.add(grid);

let active = null;

const sb = document.createElement('div');
sb.style.cssText = 'position:absolute; bottom:20px; right:20px; color:#c5c6d1; font-family:monospace; font-size:11px; text-align:center; pointer-events:none; z-index:10;';
sb.innerHTML = '<div id="scale-line" style="width:100px; height:4px; border:1px solid #c5c6d1; border-top:none; margin-bottom:2px; background:rgba(255,255,255,0.15);"></div><span id="scale-val">10 units</span>';
vp.appendChild(sb);
const scaleVal = document.getElementById('scale-val');

const xyzc = document.createElement('div');
xyzc.style.cssText = 'position:absolute; top:15px; left:15px; width:80px; height:80px; pointer-events:none; z-index:10;';
xyzc.innerHTML = `
    <div id="lbl-x" style="position:absolute; color:#ff4444; font-family:sans-serif; font-weight:bold; font-size:13px;">X</div>
    <div id="lbl-y" style="position:absolute; color:#44ff44; font-family:sans-serif; font-weight:bold; font-size:13px;">Y</div>
    <div id="lbl-z" style="position:absolute; color:#4444ff; font-family:sans-serif; font-weight:bold; font-size:13px;">Z</div>
`;
vp.appendChild(xyzc);

const lblX = document.getElementById('lbl-x');
const lblY = document.getElementById('lbl-y');
const lblZ = document.getElementById('lbl-z');

const gizmoScn = new three.Scene();
const gizmoCam = new three.OrthographicCamera(-2, 2, 2, -2, 1, 10);
gizmoCam.position.set(0, 0, 5);

const axisLines = new three.AxesHelper(1.2);
axisLines.material.linewidth = 3;
axisLines.material.renderOrder = 1;
gizmoScn.add(axisLines);

const gizmoSize = 80;

const vX = new three.Vector3();
const vY = new three.Vector3();
const vZ = new three.Vector3();

function convertJscadToThreeGeometry(jscadData) {
    const geo = new three.BufferGeometry();
    const vertices = [];
    const normals = [];

    const geometries = Array.isArray(jscadData) ? jscadData : [jscadData];

    geometries.forEach(g => {
        if (!g) return;
        const polygons = g.polygons || [];

        polygons.forEach(polygon => {
            const v = polygon.vertices;
            if (!v || v.length < 3) return;

            for (let i = 2; i < v.length; i++) {
                const p0 = v[0];
                const p1 = v[i - 1];
                const p2 = v[i];

                vertices.push(p0[0], p0[1], p0[2]);
                vertices.push(p1[0], p1[1], p1[2]);
                vertices.push(p2[0], p2[1], p2[2]);

                if (polygon.plane) {
                    const norm = polygon.plane;
                    normals.push(norm[0], norm[1], norm[2]);
                    normals.push(norm[0], norm[1], norm[2]);
                    normals.push(norm[0], norm[1], norm[2]);
                } else {
                    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
                }
            }
        });
    });

    if (vertices.length === 0) {
        console.error();
    }

    geo.setAttribute('position', new three.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('normal', new three.Float32BufferAttribute(normals, 3));
    return geo;
}

window.displayJSCAD = function(jscadstr) {
    if (active) {
        scn.remove(active);
        active.geometry.dispose();
        active.material.dispose();
    }

    try {
        const engineRef = window.jscadModeling;
        if (!engineRef) {
            throw new Error();
        }

        const runner = new Function('jscad', `
            const { cube, cylinder, sphere, torus } = jscad.primitives;
            const { union, subtract, intersect } = jscad.booleans;
            const { translate, rotate, scale } = jscad.transforms;
            const difference = subtract;
            
            ${jscadstr}
        `);

        const jscadout = runner(engineRef);
        const ngeom = convertJscadToThreeGeometry(jscadout);

        if (!(ngeom instanceof three.BufferGeometry)) {
            throw new Error();
        }

        const mat = new three.MeshStandardMaterial({
            color: 0xffa500,
            roughness: 0.4,
            metalness: 0.1,
            side: three.DoubleSide
        });

        active = new three.Mesh(ngeom, mat);

        ngeom.computeBoundingBox();
        ngeom.computeBoundingSphere();
        ngeom.center();

        scn.add(active);
        ctrl.target.set(0, 0, 0);

    } catch (err) {
        console.error(err);
    }
};

function animate() {
    requestAnimationFrame(animate);
    ctrl.update();

    ren.clear();

    ren.setViewport(0, 0, w, h);
    ren.render(scn, cam);

    gizmoCam.position.copy(cam.position);
    gizmoCam.position.setLength(4);
    gizmoCam.lookAt(0, 0, 0);

    ren.setScissorTest(true);
    ren.setScissor(15, h - gizmoSize - 15, gizmoSize, gizmoSize);
    ren.setViewport(15, h - gizmoSize - 15, gizmoSize, gizmoSize);

    ren.render(gizmoScn, gizmoCam);
    ren.setScissorTest(false);

    if (gizmoCam) {
        vX.set(1.4, 0, 0).project(gizmoCam);
        vY.set(0, 1.4, 0).project(gizmoCam);
        vZ.set(0, 0, 1.4).project(gizmoCam);

        lblX.style.left = `${(vX.x * 0.5 + 0.5) * gizmoSize}px`;
        lblX.style.top  = `${(-vX.y * 0.5 + 0.5) * gizmoSize}px`;

        lblY.style.left = `${(vY.x * 0.5 + 0.5) * gizmoSize}px`;
        lblY.style.top  = `${(-vY.y * 0.5 + 0.5) * gizmoSize}px`;

        lblZ.style.left = `${(vZ.x * 0.5 + 0.5) * gizmoSize}px`;
        lblZ.style.top  = `${(-vZ.y * 0.5 + 0.5) * gizmoSize}px`;
    }

    if (cam && ctrl) {
        const dist = cam.position.distanceTo(ctrl.target);
        const fovRad = (cam.fov * Math.PI) / 180;
        const tvht = 2 * Math.tan(fovRad / 2) * dist;
        const upp = tvht / h;

        const tub = upp * 100;

        scaleVal.innerText = tub.toFixed(1) + " units";
    }
}

ren.autoClear = false;

animate();

window.addEventListener('resize', () => {
    w = vp.clientWidth;
    h = vp.clientHeight;
    cam.aspect = w/h;
    cam.updateProjectionMatrix();
    ren.setSize(w,h);
});

window.displayJSCAD(`
    const outerRing = cylinder({ height: 4, radius: 6, segments: 32 });
    const centerHole = cylinder({ height: 10, radius: 2.5 });
    
    return difference(outerRing, centerHole);
`);



//HTIS GENUINELY TOOK AGES ITS SO WRAPS AND COOKED ICL
//TOP 10 WORST SOFTWARE OAT
//NEED TO WRITE AN OPENSCAD TO JSCAD CONVERTER :BROKENHEARTED: