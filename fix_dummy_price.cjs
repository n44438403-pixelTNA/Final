const fs = require('fs');

let adminContent = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

// Update State
adminContent = adminContent.replace(
  "const [newPkgCredits, setNewPkgCredits] = useState('');",
  "const [newPkgCredits, setNewPkgCredits] = useState('');\n  const [newPkgDummyPrice, setNewPkgDummyPrice] = useState('');"
);

// Update addPackage
const oldAddPackage = `  // --- PACKAGE MANAGER (New) ---
  const addPackage = () => {
      if (!newPkgName || !newPkgPrice || !newPkgCredits) return;
      const newPkg = {
          id: \`pkg-\${Date.now()}\`,
          name: newPkgName,
          price: Number(newPkgPrice),
          credits: Number(newPkgCredits)
      };`;

const newAddPackage = `  // --- PACKAGE MANAGER (New) ---
  const addPackage = () => {
      if (!newPkgName || !newPkgPrice || !newPkgCredits) return;
      const newPkg = {
          id: \`pkg-\${Date.now()}\`,
          name: newPkgName,
          price: Number(newPkgPrice),
          credits: Number(newPkgCredits),
          dummyPrice: newPkgDummyPrice ? Number(newPkgDummyPrice) : undefined
      };`;

adminContent = adminContent.replace(oldAddPackage, newAddPackage);

// Clear state
adminContent = adminContent.replace(
  "setNewPkgName(''); setNewPkgPrice(''); setNewPkgCredits('');",
  "setNewPkgName(''); setNewPkgPrice(''); setNewPkgCredits(''); setNewPkgDummyPrice('');"
);

// Update UI
const oldUi = `                                  <div className="w-20">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Credits</label>
                                      <input type="number" placeholder="100" value={newPkgCredits} onChange={e => setNewPkgCredits(e.target.value)} className="w-full p-2 border rounded-lg text-sm" />
                                  </div>
                                  <button onClick={addPackage} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700">
                                      <Plus size={20} />
                                  </button>`;

const newUi = `                                  <div className="w-20">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Credits</label>
                                      <input type="number" placeholder="100" value={newPkgCredits} onChange={e => setNewPkgCredits(e.target.value)} className="w-full p-2 border rounded-lg text-sm" />
                                  </div>
                                  <div className="w-20">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Dummy ₹</label>
                                      <input type="number" placeholder="199" value={newPkgDummyPrice} onChange={e => setNewPkgDummyPrice(e.target.value)} className="w-full p-2 border rounded-lg text-sm" />
                                  </div>
                                  <button onClick={addPackage} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700">
                                      <Plus size={20} />
                                  </button>`;

adminContent = adminContent.replace(oldUi, newUi);

// Display dummy price in the list
const oldDisplay = `<p className="text-xs text-slate-500">₹{pkg.price} = {pkg.credits} Credits</p>`;
const newDisplay = `<div className="text-xs text-slate-500">
    <span className="line-through text-slate-400 mr-2">{pkg.dummyPrice ? \`₹\${pkg.dummyPrice}\` : ''}</span>
    <span className="font-bold text-green-600">₹{pkg.price}</span> = {pkg.credits} Credits
</div>`;

adminContent = adminContent.replace(oldDisplay, newDisplay);

fs.writeFileSync('components/AdminDashboard.tsx', adminContent);
console.log('Dummy price updated');
