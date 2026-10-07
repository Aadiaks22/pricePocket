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

function LoginForm({ onLogin }) {
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
      <div className="login-panel">
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
          <button className="primary-button" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        </form>
      </div>
    </section>
  );
}

function ItemEditor({ item, onClose, onSaved, showToast }) {
  const [name, setName] = useState(item?.name || "");
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
        body: JSON.stringify({ name, unit: finalUnit, history, images, removedImageIds })
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
  const [selected, setSelected] = useState(new Set());
  const [editorItem, setEditorItem] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [toastMsg, setToastMsg] = useState({ text: "", visible: false });
  const [isSharing, setIsSharing] = useState(false);
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
    if (!token) return;
    try {
      const res = await fetch("/api/items", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        sessionStorage.removeItem("pricepocket-token");
        setToken(null);
        return;
      }
      if (!res.ok) throw new Error("Load failed");
      const data = await res.json();
      setItems(data);
    } catch {
      if (!silent) showToast("Unable to load prices");
    }
  };

  useEffect(() => {
    if (token) {
      loadItems();
      refreshTimer.current = setInterval(() => loadItems(true), 10000);
    }
    return () => clearInterval(refreshTimer.current);
  }, [token]);

  if (!token) {
    return (
      <>
        <LoginForm onLogin={setToken} />
        <Toast message={toastMsg.text} visible={toastMsg.visible} />
      </>
    );
  }

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

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

  return (
    <>
      <main className="app-shell">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark">₹</div>
            <div><p className="eyebrow">ADASH SILAI MATERIALS</p><h1>PricePocket</h1></div>
          </div>
          <div className="header-actions">
            <button className="sign-out" onClick={() => { sessionStorage.removeItem("pricepocket-token"); setToken(null); }}>Sign out</button>
            <button className={`icon-button ${selected.size ? "has-selection" : ""} ${isSharing ? "share-loading" : ""}`} onClick={handleShare} aria-label="Share">
              <svg viewBox="0 0 24 24"><path d="M18 8a3 3 0 1 0-2.82-4A3 3 0 0 0 15.2 5L8.9 8.15a3 3 0 1 0 0 7.7l6.3 3.15a3 3 0 1 0 .9-1.8l-6.3-3.15a3 3 0 0 0 0-2.1L16.1 8.8A3 3 0 0 0 18 8Z"/></svg>
              <span className="selection-count">{selected.size}</span>
            </button>
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
          {selected.size > 0 && <button className="filter-button" onClick={() => setSelected(new Set())}>Clear</button>}
        </section>

        {filtered.length > 0 ? (
          <section className="items">
            {filtered.map(item => (
              <article key={item.id} className={`item-row ${selected.has(item.id) ? "selected" : ""}`}>
                <input className="select-dot" type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} />
                {item.images?.[0]?.signedUrl && <img className="item-thumb" src={item.images[0].signedUrl} alt="" />}
                <div className="item-main">
                  <h3 className="item-name">{item.name}</h3>
                  <div className="history-list">
                    {item.history.slice(0, 3).map((price, i) => <span key={i} className="history-price">{money(price)}</span>)}
                  </div>
                </div>
                <div className="row-price">
                  <div className="price">{money(item.history[0])}</div>
                  <div className="unit">per {unitText(item.unit)}</div>
                </div>
                <div className="row-actions">
                  <button className="mini-action" onClick={() => { setEditorItem(item); setShowEditor(true); }}>Edit</button>
                  <button className="mini-action delete" onClick={() => handleDelete(item.id, item.name)}>×</button>
                </div>
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

      <button className="fab" onClick={() => { setEditorItem(null); setShowEditor(true); }}>
        <span>+</span> Add item
      </button>

      {showEditor && (
        <ItemEditor 
          item={editorItem} 
          onClose={() => setShowEditor(false)} 
          onSaved={(msg) => { setShowEditor(false); loadItems(); showToast(msg); }} 
          showToast={showToast} 
        />
      )}

      <Toast message={toastMsg.text} visible={toastMsg.visible} />
    </>
  );
}
