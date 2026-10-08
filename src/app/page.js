"use client";

import { useState, useEffect, useRef } from "react";

const money = (v) => `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const unitText = (u) => ({ piece: "piece", kg: "kg", gram: "100 g", litre: "litre", packet: "packet", dozen: "dozen" }[u] || u);

function Toast({ message, visible }) {
  return (
    <div className={`toast ${visible ? "show" : ""}`} role="status">
      {message}
    </div>
  );
}

function LoginForm({ onLogin, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      sessionStorage.setItem("pricepocket-token", data.token);
      onLogin(data.token);
    } catch (err) {
      setError("Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-screen">
      <div className="login-panel" style={{ position: "relative" }}>
        {onBack && (
          <button 
            type="button" 
            onClick={onBack} 
            style={{ position: "absolute", top: "24px", right: "24px", padding: "6px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", backgroundColor: "white", color: "#0f172a", fontWeight: "600", cursor: "pointer", fontSize: "14px" }}
          >
            Back
          </button>
        )}
        <div className="brand-lockup">
          <div className="brand-mark">₹</div>
          <div>
            <p className="eyebrow">ADASH SILAI MATERIALS</p>
            <h1>PricePocket</h1>
          </div>
        </div>
        <div className="login-copy">
          <p className="eyebrow">STAFF ACCESS</p>
          <h2>Your shop prices,<br />always current.</h2>
          <p>Sign in to view and update the live price list.</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>Email<input type="email" required placeholder="you@yourshop.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Password<input type="password" required placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <p className="login-error" role="alert">{error}</p>
          <button className="primary-button" type="submit" disabled={loading} style={{ width: "100%", marginTop: "16px" }}>{loading ? "Signing in..." : "Sign in"}</button>
        </form>
      </div>
    </section>
  );
}

function ItemEditor({ item, onClose, onSaved, showToast, existingCategories = [] }) {
  const [name, setName] = useState(item?.name || "");
  const initialCategory = item ? (existingCategories.includes(item.category) ? item.category : "custom") : (existingCategories.length > 0 ? existingCategories[0] : "custom");
  const [category, setCategory] = useState(initialCategory);
  const [customCategoryStr, setCustomCategoryStr] = useState(initialCategory === "custom" ? (item?.category || "") : "");
  const [price, setPrice] = useState(item?.history?.[0] || "");
  const fixedUnits = ["piece", "kg", "gram", "litre", "packet", "dozen"];
  const initialUnit = item ? (fixedUnits.includes(item.unit) ? item.unit : "custom") : "piece";
  const [unit, setUnit] = useState(initialUnit);
  const [customUnitStr, setCustomUnitStr] = useState(initialUnit === "custom" ? item.unit : "");
  
  const [editorImages, setEditorImages] = useState(item?.images || []);
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const incoming = Array.from(e.target.files);
    if (editorImages.length + incoming.length > 3) {
      showToast("You can add up to 3 photos only");
      e.target.value = "";
      return;
    }
    const newImages = incoming.map(file => ({ file, previewUrl: URL.createObjectURL(file) }));
    setEditorImages([...editorImages, ...newImages]);
    e.target.value = "";
  };

  const removeImage = (index) => {
    const removed = editorImages[index];
    if (removed.fileId) setRemovedImageIds([...removedImageIds, removed.fileId]);
    setEditorImages(editorImages.filter((_, i) => i !== index));
  };

  const uploadImage = async (file) => {
    const token = sessionStorage.getItem("pricepocket-token");
    const authRes = await fetch("/api/imagekit-auth", { headers: { Authorization: `Bearer ${token}` } });
    if (!authRes.ok) throw new Error("Image auth failed");
    const auth = await authRes.json();
    
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-");
    const body = new FormData();
    body.append("file", file);
    body.append("fileName", `${crypto.randomUUID()}-${safeName}`);
    body.append("folder", "/pricepocket");
    body.append("useUniqueFileName", "true");
    body.append("isPrivateFile", "true");
    body.append("publicKey", auth.publicKey);
    body.append("signature", auth.signature);
    body.append("expire", auth.expire);
    body.append("token", auth.token);
    
    const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body });
    const image = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(image.message || "ImageKit upload failed");
    return { fileId: image.fileId, filePath: image.filePath, name: image.name, url: image.url };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalUnit = unit === "custom" ? customUnitStr.trim() : unit;
    if (!finalUnit) return showToast("Enter a custom unit");
    const finalCategory = category === "custom" ? customCategoryStr.trim() : category;
    if (!finalCategory) return showToast("Enter a category");
    
    const token = sessionStorage.getItem("pricepocket-token");
    setLoading(true);
    
    try {
      const numPrice = Number(price);
      let history = [numPrice];
      if (item) {
        history = item.history[0] === numPrice ? item.history : [numPrice, ...item.history].slice(0, 3);
      }
      
      const newFiles = editorImages.filter(img => img.file);
      const uploaded = await Promise.all(newFiles.map(img => uploadImage(img.file)));
      const existing = editorImages.filter(img => !img.file).map(({ fileId, filePath, name, url }) => ({ fileId, filePath, name, url }));
      const images = [...existing, ...uploaded];
      
      const url = item ? `/api/items?id=${encodeURIComponent(item.id)}` : "/api/items";
      const res = await fetch(url, {
        method: item ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, category: finalCategory, unit: finalUnit, history, images, removedImageIds })
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      
      onSaved(item ? "Item updated for everyone" : "Item added for everyone");
    } catch (err) {
      showToast(err.message || "Could not save item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose}></div>
      <section className="bottom-sheet" aria-labelledby="editorTitle">
        <div className="sheet-handle"></div>
        <div className="sheet-head">
          <h2 id="editorTitle">{item ? "Edit item" : "Add an item"}</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label>Item name<input required maxLength="40" placeholder="e.g. Basmati Rice" value={name} onChange={e => setName(e.target.value)} /></label>
          <label>Category
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {existingCategories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="custom">Add New Category...</option>
            </select>
          </label>
          {category === "custom" && (
            <label>New category name<input required maxLength="40" placeholder="e.g. Electronics" value={customCategoryStr} onChange={e => setCustomCategoryStr(e.target.value)} /></label>
          )}
          <div className="form-row">
            <label>Price (₹)<input type="number" required min="0" step="0.01" placeholder="0" value={price} onChange={e => setPrice(e.target.value)} /></label>
            <label>Per
              <select value={unit} onChange={e => setUnit(e.target.value)}>
                {fixedUnits.map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
                <option value="custom">Custom</option>
              </select>
            </label>
          </div>
          {unit === "custom" && (
            <label>Custom unit<input maxLength="20" placeholder="e.g. 5 pieces" value={customUnitStr} onChange={e => setCustomUnitStr(e.target.value)} /></label>
          )}
          <label className="image-input">Item photos <span>Up to 3 photos</span><input type="file" accept="image/*" multiple onChange={handleImageChange} /></label>
          <div className="image-preview">
            {editorImages.map((img, i) => (
              <div key={i} className="preview-card">
                <img src={img.signedUrl || img.previewUrl} alt="Preview" />
                <button type="button" className="remove-image" onClick={() => removeImage(i)}>×</button>
              </div>
            ))}
          </div>
          <p className="form-note">Saving a new price keeps the last 3 price updates.</p>
          <button className="primary-button" type="submit" disabled={loading}>{loading ? "Saving..." : "Save item"}</button>
        </form>
      </section>
    </>
  );
}

export default function Dashboard() {
  const [token, setToken] = useState(null);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selected, setSelected] = useState(new Set());
  const [editorItem, setEditorItem] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [cart, setCart] = useState({});
  const [showCart, setShowCart] = useState(false);
  const [toastMsg, setToastMsg] = useState({ text: "", visible: false });
  const [isSharing, setIsSharing] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const refreshTimer = useRef(null);

  useEffect(() => {
    const t = sessionStorage.getItem("pricepocket-token");
    if (t) setToken(t);
  }, []);

  const showToast = (text) => {
    setToastMsg({ text, visible: true });
    setTimeout(() => setToastMsg(prev => ({ ...prev, visible: false })), 2400);
  };

  const loadItems = async (silent = false) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch("/api/items", { headers });
      if (res.status === 401) {
        sessionStorage.removeItem("pricepocket-token");
        setToken(null);
      }
      if (!res.ok) throw new Error("Load failed");
      const data = await res.json();
      setItems(data);
    } catch {
      if (!silent) showToast("Unable to load prices");
    }
  };

  useEffect(() => {
    loadItems();
    refreshTimer.current = setInterval(() => loadItems(true), 10000);
    return () => clearInterval(refreshTimer.current);
  }, [token]);

  if (showLogin) {
    return (
      <>
        <LoginForm onLogin={(t) => { setToken(t); setShowLogin(false); }} onBack={() => setShowLogin(false)} />
        <Toast message={toastMsg.text} visible={toastMsg.visible} />
      </>
    );
  }

  const categories = ["All", ...Array.from(new Set(items.map(i => i.category || "Uncategorized"))).sort()];
  
  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === "All" || (i.category || "Uncategorized") === selectedCategory;
    return matchSearch && matchCat;
  });

  const handleUpdateCart = (id, change) => {
    setCart(prev => {
      const next = { ...prev };
      const current = next[id] || 0;
      const updated = current + change;
      if (updated <= 0) delete next[id];
      else next[id] = updated;
      return next;
    });
  };

  const handleSetCart = (id, value) => {
    setCart(prev => {
      const next = { ...prev };
      const val = parseInt(value, 10);
      if (isNaN(val) || val <= 0) delete next[id];
      else next[id] = val;
      return next;
    });
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await fetch(`/api/items?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
      loadItems();
      showToast("Item deleted for everyone");
    } catch {
      showToast("Could not delete item");
    }
  };

  const handleShare = async () => {
    const chosen = items.filter(i => selected.has(i.id));
    if (!chosen.length) return showToast("Select items to share first");
    
    setIsSharing(true);
    try {
      const imageFiles = [];
      for (const item of chosen) {
        for (const image of item.images || []) {
          const res = await fetch(image.signedUrl);
          if (res.ok) {
            const blob = await res.blob();
            imageFiles.push(new File([blob], image.name || "product-photo.jpg", { type: blob.type || "image/jpeg" }));
          }
        }
      }
      const text = `Adash Silai Materials — Current prices.\n\n${chosen.map(i => `• ${i.name}: ${money(i.history[0])} per ${unitText(i.unit)}`).join("\n")}`;
      
      if (imageFiles.length && navigator.canShare?.({ files: imageFiles })) {
        await navigator.share({ title: "Adash Silai Materials", text, files: imageFiles });
      } else if (navigator.share) {
        await navigator.share({ title: "Adash Silai Materials", text });
        showToast("Details shared without images.");
      } else {
        await navigator.clipboard.writeText(text);
        showToast("Details copied without images.");
      }
    } catch (err) {
      if (err.name !== "AbortError") showToast("Could not prepare photos for sharing");
    } finally {
      setIsSharing(false);
    }
  };

  const shareCartWhatsApp = () => {
    const lines = ["*New Order Request:*", ""];
    let total = 0;
    Object.keys(cart).forEach(id => {
      const item = items.find(i => i.id === id);
      if (item) {
        const qty = cart[id];
        const cost = qty * item.history[0];
        total += cost;
        lines.push(`• ${item.name}`);
        lines.push(`  ${qty} ${unitText(item.unit)} x ${money(item.history[0])} = ${money(cost)}`);
      }
    });
    lines.push("");
    lines.push(`*Estimated Total: ${money(total)}*`);
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <>
      <main className="app-shell">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark">₹</div>
            <div><p className="eyebrow">ADASH SILAI MATERIALS</p><h1>PricePocket</h1></div>
          </div>
          <div className="header-actions">
            {token ? (
              <button className="sign-out" onClick={() => { sessionStorage.removeItem("pricepocket-token"); setToken(null); }}>Sign out</button>
            ) : (
              <button className="sign-out" onClick={() => setShowLogin(true)}>Admin Login</button>
            )}
            {token && (
              <button className={`icon-button ${selected.size ? "has-selection" : ""} ${isSharing ? "share-loading" : ""}`} onClick={handleShare} aria-label="Share">
                <svg viewBox="0 0 24 24"><path d="M18 8a3 3 0 1 0-2.82-4A3 3 0 0 0 15.2 5L8.9 8.15a3 3 0 1 0 0 7.7l6.3 3.15a3 3 0 1 0 .9-1.8l-6.3-3.15a3 3 0 0 0 0-2.1L16.1 8.8A3 3 0 0 0 18 8Z"/></svg>
                <span className="selection-count">{selected.size}</span>
              </button>
            )}
          </div>
        </header>

        <section className="intro">
          <div><p className="eyebrow">INVENTORY</p><h2>Today’s prices</h2></div>
          <p id="itemSummary">{items.length} item{items.length !== 1 ? "s" : ""} in your shop</p>
        </section>

        <section className="toolbar">
          <label className="search">
            <svg viewBox="0 0 24 24"><path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"/></svg>
            <input type="search" placeholder="Search items" value={search} onChange={e => setSearch(e.target.value)} />
          </label>
          <select 
            value={selectedCategory} 
            onChange={e => setSelectedCategory(e.target.value)}
            style={{ width: '130px', height: '44px', border: '1px solid #e7eaf0', borderRadius: '12px', padding: '0 12px', outline: 'none', background: '#fff', color: '#172033', fontWeight: '600' }}
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {selected.size > 0 && <button className="filter-button" onClick={() => setSelected(new Set())}>Clear</button>}
        </section>

        {filtered.length > 0 ? (
          <section className="items">
            {filtered.map(item => (
              <article key={item.id} className={`item-row ${selected.has(item.id) ? "selected" : ""}`}>
                {token && <input className="select-dot" type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} />}
                {item.images && item.images.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {item.images.map((img, idx) => (
                      img.signedUrl && (
                        <img 
                          key={idx}
                          className="item-thumb clickable-thumb" 
                          src={img.signedUrl} 
                          alt={`${item.name} ${idx + 1}`} 
                          onClick={() => setPreviewImage(img.signedUrl)}
                        />
                      )
                    ))}
                  </div>
                )}
                <div className="item-main">
                  <h3 className="item-name">{item.name} <span style={{fontSize: '10px', color: '#72809a', marginLeft: '6px', fontWeight: '600', padding: '2px 6px', background: '#f6f8fc', borderRadius: '6px', border: '1px solid #e7eaf0'}}>{item.category || 'Uncategorized'}</span></h3>
                  {token && (
                    <div className="history-list">
                      {item.history.slice(0, 3).map((price, i) => <span key={i} className="history-price">{money(price)}</span>)}
                    </div>
                  )}
                </div>
                <div className="row-price">
                  <div className="price">{money(item.history[0])}</div>
                  <div className="unit">per {unitText(item.unit)}</div>
                  {!token && (
                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                      {cart[item.id] ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button className="mini-action" onClick={() => handleUpdateCart(item.id, -1)}>−</button>
                          <input 
                            type="number" 
                            min="0"
                            value={cart[item.id] || ""} 
                            onChange={(e) => handleSetCart(item.id, e.target.value)}
                            style={{ width: '40px', height: '28px', textAlign: 'center', padding: '0', border: '1px solid #e7eaf0', borderRadius: '6px', fontWeight: '700' }} 
                          />
                          <button className="mini-action" onClick={() => handleUpdateCart(item.id, 1)}>+</button>
                        </div>
                      ) : (
                        <button className="mini-action" onClick={() => handleUpdateCart(item.id, 1)} style={{ background: '#eef2f8', color: '#1d4ed8' }}>+ Add</button>
                      )}
                    </div>
                  )}
                </div>
                {token && (
                  <div className="row-actions">
                    <button className="mini-action" onClick={() => { setEditorItem(item); setShowEditor(true); }}>Edit</button>
                    <button className="mini-action delete" onClick={() => handleDelete(item.id, item.name)}>×</button>
                  </div>
                )}
              </article>
            ))}
          </section>
        ) : (
          <section className="empty-state">
            <div className="empty-icon">⌁</div>
            <h3>No items found</h3>
            <p>Add your first item to start tracking its price.</p>
          </section>
        )}
      </main>

      {token && (
        <button className="fab" onClick={() => { setEditorItem(null); setShowEditor(true); }}>
          <span>+</span> Add item
        </button>
      )}
      
      {!token && Object.keys(cart).length > 0 && (
        <button className="fab" onClick={() => setShowCart(true)} style={{ background: '#10b981', boxShadow: '0 12px 25px rgba(16, 185, 129, 0.3)' }}>
          View Cart ({Object.keys(cart).length})
        </button>
      )}

      {showCart && (
        <>
          <div className="sheet-backdrop" onClick={() => setShowCart(false)}></div>
          <section className="bottom-sheet" aria-labelledby="cartTitle">
            <div className="sheet-handle"></div>
            <div className="sheet-head">
              <h2 id="cartTitle">Your Order</h2>
              <button className="close-button" onClick={() => setShowCart(false)}>×</button>
            </div>
            <div style={{ marginTop: '16px', maxHeight: '50vh', overflowY: 'auto' }}>
              {Object.keys(cart).map(id => {
                const item = items.find(i => i.id === id);
                if (!item) return null;
                const cost = cart[item.id] * item.history[0];
                return (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #e7eaf0' }}>
                    <div>
                      <div style={{fontWeight: '700', fontSize: '15px'}}>{item.name}</div>
                      <div style={{fontSize: '12px', color: '#72809a', marginTop: '4px'}}>{money(item.history[0])} / {unitText(item.unit)} <span style={{fontWeight: '600', color: '#172033', marginLeft: '6px'}}>= {money(cost)}</span></div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button className="mini-action" onClick={() => handleUpdateCart(item.id, -1)}>−</button>
                      <input 
                        type="number" 
                        min="0"
                        value={cart[item.id] || ""} 
                        onChange={(e) => handleSetCart(item.id, e.target.value)}
                        style={{ width: '40px', height: '28px', textAlign: 'center', padding: '0', border: '1px solid #e7eaf0', borderRadius: '6px', fontWeight: '700' }} 
                      />
                      <button className="mini-action" onClick={() => handleUpdateCart(item.id, 1)}>+</button>
                      <button className="mini-action delete" onClick={() => handleSetCart(item.id, 0)} style={{ marginLeft: '4px' }}>×</button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {Object.keys(cart).length > 0 && (
              <div style={{ marginTop: '16px', padding: '12px 0', borderTop: '2px solid #e7eaf0', display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '16px', color: '#172033' }}>
                <span>Grand Total</span>
                <span>{money(Object.keys(cart).reduce((sum, id) => {
                  const i = items.find(it => it.id === id);
                  return sum + (i ? cart[id] * i.history[0] : 0);
                }, 0))}</span>
              </div>
            )}
            
            <button className="primary-button" onClick={shareCartWhatsApp} style={{ marginTop: '16px', background: '#25D366' }}>
              Send Order via WhatsApp
            </button>
          </section>
        </>
      )}

      {showEditor && (
        <ItemEditor 
          item={editorItem} 
          onClose={() => setShowEditor(false)} 
          onSaved={(msg) => { setShowEditor(false); loadItems(); showToast(msg); }} 
          showToast={showToast} 
          existingCategories={categories.filter(c => c !== "All")}
        />
      )}

      {previewImage && (
        <div className="image-preview-modal" onClick={() => setPreviewImage(null)}>
          <button className="close-preview" onClick={() => setPreviewImage(null)}>×</button>
          <img src={previewImage} alt="Preview" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <Toast message={toastMsg.text} visible={toastMsg.visible} />
    </>
  );
}
