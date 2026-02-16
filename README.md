<h1 align="center">Holst</h1>

<p align="center">
  <strong>A fast, minimal drag-and-drop desktop canvas for diagrams and visual thinking.</strong>
</p>

<p align="center">
  Built with TypeScript + Rust, powered by Tauri.
</p>



<hr/>

<h2>✨ Overview</h2>

<p>
<strong>Holst</strong> is a lightweight, high-performance desktop canvas application for quickly creating:
</p>

<ul>
  <li>System diagrams</li>
  <li>Flowcharts</li>
  <li>Architecture sketches</li>
  <li>Educational visuals</li>
  <li>Brainstorm layouts</li>
</ul>

<p>
It focuses on <strong>clarity, speed, and essential functionality</strong> — no bloated toolbars, no feature overload.
</p>

<hr/>

<h2>🧩 Elements</h2>

<h3>▢ Box</h3>
<ul>
  <li>Hollow shape</li>
  <li>Optional text inside</li>
  <li>Fully resizable</li>
</ul>

<h3>◯ Circle</h3>
<ul>
  <li>Hollow shape</li>
  <li>Optional text inside</li>
  <li>Fully resizable</li>
</ul>

<h3>─ Line</h3>
<ul>
  <li>Adjustable length</li>
  <li>Rotatable</li>
</ul>

<h3>➜ Arrow</h3>
<ul>
  <li>Adjustable length</li>
  <li>Rotatable</li>
</ul>

<h3>📝 Text Block</h3>
<ul>
  <li>Independent movable text element</li>
</ul>

<hr/>

<h2>🔄 Undo / Redo</h2>

<p>Holst includes a full action history system.</p>

<ul>
  <li>Element creation</li>
  <li>Deletion</li>
  <li>Move</li>
  <li>Resize</li>
  <li>Rotate</li>
  <li>Text edits</li>
</ul>

<p>Designed for predictable, professional workflow.</p>

<hr/>

<h2>🔁 Import / Export</h2>

<ul>
  <li>Export canvas to file</li>
  <li>Import saved projects</li>
  <li>Full layout restoration:
    <ul>
      <li>Element types</li>
      <li>Positions</li>
      <li>Sizes</li>
      <li>Rotations</li>
      <li>Text content</li>
    </ul>
  </li>
</ul>

<hr/>

<h2>🚀 Why Holst?</h2>

<ul>
  <li>⚡ Native performance (Rust backend)</li>
  <li>🖥 Lightweight desktop footprint (Tauri)</li>
  <li>🧠 Minimalist UX</li>
  <li>🔒 Secure by design</li>
  <li>🧩 Focused feature set</li>
</ul>

<hr/>

<h2>🏗 Architecture</h2>

<ul>
  <li><strong>Frontend:</strong> TypeScript</li>
  <li><strong>Backend:</strong> Rust</li>
  <li><strong>Desktop Framework:</strong> Tauri</li>
</ul>

<p>
Rust handles core logic and system-level interaction.<br/>
TypeScript manages the interactive canvas UI.
</p>

<hr/>

<h2>🛠 Getting Started</h2>

<h3>Prerequisites</h3>

<ul>
  <li>Node.js (LTS recommended)</li>
  <li>Rust (stable)</li>
  <li>Tauri CLI</li>
</ul>

<h3>Installation</h3>

<pre><code>git clone https://github.com/your-username/holst.git
cd holst
npm install</code></pre>

<h3>Run in Development</h3>

<pre><code>npm run tauri dev</code></pre>

<h3>Build Production App</h3>

<pre><code>npm run tauri build</code></pre>

<hr/>

<h2>📌 Roadmap</h2>

<ul>
  <li>Snap-to-grid</li>
  <li>Multi-select</li>
  <li>Layer management</li>
  <li>SVG export</li>
  <li>PNG export</li>
  <li>Extended keyboard shortcuts</li>
  <li>Plugin architecture</li>
</ul>

<hr/>

<h2>🤝 Contributing</h2>

<p>
Contributions are welcome.
</p>

<ol>
  <li>Fork the repository</li>
  <li>Create a feature branch</li>
  <li>Submit a pull request</li>
</ol>

<p>
Please keep the project philosophy in mind:<br/>
<strong>Minimal, fast, essential.</strong>
</p>

<hr/>

<h2>📄 License</h2>

<p>MIT License</p>
