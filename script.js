let notes = JSON.parse(localStorage.getItem("notes")) || [];
let folders = JSON.parse(localStorage.getItem("folders")) || [];
let currentNoteId = null;
let savedRange = null;

const notesList = document.getElementById("notes-list");
const folderSelect = document.getElementById("folderSelect");
const editor = document.getElementById("editor");
const titleInput = document.getElementById("note-title");

function saveData() {
    localStorage.setItem("notes", JSON.stringify(notes));
    localStorage.setItem("folders", JSON.stringify(folders));
}

function updateToolbar() {
    const boldBtn = document.getElementById("boldBtn");
    const italicBtn = document.getElementById("italicBtn");
    const underlineBtn = document.getElementById("underlineBtn");
    const ulBtn = document.getElementById("ulBtn");
    const olBtn = document.getElementById("olBtn");

    boldBtn.classList.toggle("active", document.queryCommandState("bold"));
    italicBtn.classList.toggle("active", document.queryCommandState("italic"));
    underlineBtn.classList.toggle("active", document.queryCommandState("underline"));

    // تشخیص لیست
    const sel = window.getSelection();
    let node = sel.anchorNode;
    if (!node) return;

    if (node.nodeType === 3) node = node.parentNode;

    let isUL = false;
    let isOL = false;

    while (node && node !== editor) {
        if (node.tagName === "UL") isUL = true;
        if (node.tagName === "OL") isOL = true;
        node = node.parentNode;
    }

    ulBtn.classList.toggle("active", isUL);
    olBtn.classList.toggle("active", isOL);
}

editor.addEventListener("keyup", updateToolbar);
editor.addEventListener("mouseup", updateToolbar);
document.addEventListener("selectionchange", updateToolbar);

// ایجاد یادداشت جدید با شماره
function createNewNote() {
    const title = "یادداشت جدید " + (notes.length + 1);
    const newNote = {
        id: "n_" + Date.now(),
        title: title,
        content: "",
        folderId: null,
        pinned: false
    };
    notes.unshift(newNote);
    saveData();
    openNote(newNote.id);
}

// ایجاد پوشه با چک کردن نام تکراری
function createNewFolder() {
    const name = prompt("نام پوشه جدید:");
    if (!name || !name.trim()) return;
    if (folders.some(f => f.name === name.trim())) {
        alert("نام پوشه تکراری است!");
        return;
    }
    const newFolder = { id: "f_" + Date.now(), name: name.trim() };
    folders.push(newFolder);
    saveData();
    renderSidebar();
}

function openNote(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    currentNoteId = id;
    titleInput.value = note.title;
    editor.innerHTML = parseMarkdown(note.content);
    updateFolderDropdown();
    renderSidebar();
}

function saveCurrentNote() {
    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;

    const newTitle = titleInput.value.trim();
    const exists = notes.some(n => n.id !== currentNoteId && n.title === newTitle);
    if (exists) return;

    note.title = newTitle;
    note.content = editor.innerHTML;

    saveData();
    const activeNoteElement = document.querySelector('.note-item.active .note-title');
    if (activeNoteElement) activeNoteElement.innerText = newTitle || "یادداشت بدون عنوان";
}

function togglePin() {
    if (!currentNoteId) return;
    const note = notes.find(n => n.id === currentNoteId);
    note.pinned = !note.pinned;
    saveData();
    renderSidebar();
}

function moveNoteToFolder(folderId) {
    if (!currentNoteId) return;
    const note = notes.find(n => n.id === currentNoteId);
    note.folderId = folderId === "0" ? null : folderId;
    saveData();
    renderSidebar();
}

function deleteCurrentNote() {
    if (!currentNoteId || !confirm("حذف شود؟")) return;
    notes = notes.filter(n => n.id !== currentNoteId);
    currentNoteId = null;
    titleInput.value = "";
    editor.innerHTML = parseMarkdown("");
    saveData();
    renderSidebar();
}

function renderSidebar() {
    notesList.innerHTML = "";
    const searchTerm = document.getElementById("search").value.toLowerCase();

    // مرتب‌سازی: اول انگلیسی، بعد فارسی، و داخل هر گروه الفبایی
    const sortNotes = (a, b) => {
        const aTitle = (a.title || "").trim();
        const bTitle = (b.title || "").trim();

        const aEnglish = /^[A-Za-z]/.test(aTitle);
        const bEnglish = /^[A-Za-z]/.test(bTitle);

        const aPersian = /^[\u0600-\u06FF]/.test(aTitle);
        const bPersian = /^[\u0600-\u06FF]/.test(bTitle);

        // اول انگلیسی
        if (aEnglish && !bEnglish) return -1;
        if (!aEnglish && bEnglish) return 1;

        // بعد فارسی
        if (aPersian && !bPersian) return -1;
        if (!aPersian && bPersian) return 1;

        // داخل هر گروه: مرتب‌سازی الفبایی
        return aTitle.localeCompare(bTitle, "en", {
            sensitivity: "base",
            numeric: true
        });
    };

    // ۱. پین‌شده‌ها
    const pinned = notes
        .filter(n => n.pinned && n.title.toLowerCase().includes(searchTerm))
        .sort(sortNotes);

    if (pinned.length > 0) {
        const pinSection = createGroupUI("📌 پین شده", pinned);
        notesList.appendChild(pinSection);
    }

    // ۲. یادداشت‌های بدون پوشه
    const noFolder = notes
        .filter(n => !n.pinned && !n.folderId && n.title.toLowerCase().includes(searchTerm))
        .sort(sortNotes);

    if (noFolder.length > 0) {
        const noFolderSection = createGroupUI("📂 یادداشت‌ها", noFolder);
        notesList.appendChild(noFolderSection);
    }

    // ۳. یادداشت‌های هر پوشه
    folders.forEach(f => {
        const folderNotes = notes
            .filter(n => !n.pinned && n.folderId === f.id && n.title.toLowerCase().includes(searchTerm))
            .sort(sortNotes);

        const folderSection = createGroupUI(`📁 ${f.name}`, folderNotes, f.id);
        notesList.appendChild(folderSection);
    });
}

function createGroupUI(title, groupNotes, folderId = null) {
    const container = document.createElement("div");
    container.className = "folder-group";

    const header = document.createElement("div");
    header.className = "folder-header";
    header.innerHTML = `<span>${title}</span>`;
    if (folderId) {
        header.innerHTML += `<span onclick="deleteFolder('${folderId}')">🗑</span>`;
    }
    container.appendChild(header);

    groupNotes.forEach(note => {
        const item = document.createElement("div");
        item.className = `note-item-container ${note.id === currentNoteId ? 'active' : ''}`;
        item.innerHTML = `<span>${note.pinned ? '📌 ' : ''}${note.title}</span>`;
        item.onclick = () => openNote(note.id);
        container.appendChild(item);
    });
    return container;
}

function deleteFolder(id) {
    if (!confirm("پوشه حذف شود؟ یادداشت‌ها نمی‌روند.")) return;
    folders = folders.filter(f => f.id !== id);
    notes.forEach(n => { if (n.folderId === id) n.folderId = null; });
    saveData();
    renderSidebar();
}

function updateFolderDropdown() {
    let html = '<option value="0">بدون پوشه</option>';
    folders.forEach(f => {
        html += `<option value="${f.id}">${f.name}</option>`;
    });
    folderSelect.innerHTML = html;
    const note = notes.find(n => n.id === currentNoteId);
    if (note) folderSelect.value = note.folderId || "0";
}

function format(command) {
    document.execCommand(command, false, null);
    updateToolbar();
    saveCurrentNote(); // اگر سیستم ذخیره داری
}

function saveSelection() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        savedRange = sel.getRangeAt(0);
    }
}

function restoreSelection() {
    const sel = window.getSelection();
    if (savedRange) {
        sel.removeAllRanges();
        sel.addRange(savedRange);
    }
}

function changeColor(color) {
    editor.focus();
    restoreSelection();

    document.execCommand("styleWithCSS", false, true);
    document.execCommand("foreColor", false, color);

    saveSelection();
    saveCurrentNote();
}

function updateColorPicker() {
    const picker = document.getElementById("color-picker");
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    let node = sel.anchorNode;
    if (!node) return;

    if (node.nodeType === 3) node = node.parentElement;

    const color = window.getComputedStyle(node).color;
    const rgb = color.match(/\d+/g);
    if (!rgb) return;

    const hex =
        "#" +
        rgb
            .slice(0, 3)
            .map(v => Number(v).toString(16).padStart(2, "0"))
            .join("");

    picker.value = hex;
}

editor.addEventListener("mouseup", saveSelection);
editor.addEventListener("keyup", saveSelection);

editor.addEventListener("mouseup", updateColorPicker);
editor.addEventListener("keyup", updateColorPicker);
document.addEventListener("selectionchange", updateColorPicker);

editor.addEventListener("input", saveCurrentNote);


function applyMarkdown(prefix, suffix = "") {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    const markdownText = prefix + selectedText + suffix;
    document.execCommand("insertText", false, markdownText);
    saveCurrentNote();
}

function parseMarkdown(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
        .replace(/__(.*?)__/g, "<b>$1</b>")
        .replace(/\*(.*?)\*/g, "<i>$1</i>")
        .replace(/_(.*?)_/g, "<i>$1</i>")
        .replace(/`(.*?)`/g, "<code>$1</code>")
        .replace(/###### (.*)/g, "<h6>$1</h6>")
        .replace(/##### (.*)/g, "<h5>$1</h5>")
        .replace(/#### (.*)/g, "<h4>$1</h4>")
        .replace(/### (.*)/g, "<h3>$1</h3>")
        .replace(/## (.*)/g, "<h2>$1</h2>")
        .replace(/# (.*)/g, "<h1>$1</h1>")
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
        .replace(/'''([\s\S]*?)'''/g, function (match, code) {
            return '<pre class="code-block"><code>' +
                code.replace(/</g, "&lt;").replace(/>/g, "&gt;") +
                '</code></pre><p><br></p>';
        });
}

function applyMarkdown(prefix, suffix = "") {

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    // ✅ INLINE CODE TOGGLE
    if (prefix === "`" && suffix === "`") {

        let node = range.startContainer;

        if (node.nodeType === 3) {
            node = node.parentElement;
        }

        const codeParent = node.closest("code");

        // ✅ اگر داخل code بود → خارج کن
        if (codeParent) {

            const text = document.createTextNode(codeParent.textContent);
            codeParent.replaceWith(text);

            const newRange = document.createRange();
            newRange.selectNodeContents(text);

            selection.removeAllRanges();
            selection.addRange(newRange);

            saveCurrentNote();
            return;
        }

        // ✅ اگر نبود → code بساز
        if (!selectedText) return;

        const codeEl = document.createElement("code");
        codeEl.textContent = selectedText;

        range.deleteContents();
        range.insertNode(codeEl);

        selection.removeAllRanges();

        saveCurrentNote();
        return;
    }

    // سایر markdown ها
    const markdownText = prefix + selectedText + suffix;
    document.execCommand("insertText", false, markdownText);

    saveCurrentNote();
}

function addLink() {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) {
        alert("اول یک متن را انتخاب کن.");
        return;
    }

    const url = prompt("آدرس لینک را وارد کنید:", "https://");
    if (!url) return;

    editor.focus();
    document.execCommand("createLink", false, url);

    saveCurrentNote();
}

function saveCurrentNote() {

    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;

    const newTitle = titleInput.value.trim();
    const normalized = newTitle.toLowerCase();

    const exists = notes.some(n =>
        n.id !== currentNoteId &&
        n.title.trim().toLowerCase() === normalized
    );

    if (exists) {
        alert("یادداشتی با این نام قبلاً وجود دارد");
        titleInput.value = note.title;
        return;
    }

    note.title = newTitle;
    note.content = editor.innerHTML;

    saveData();
}

function applyHeader(level) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    if (!selectedText) return;

    const prefix = "#".repeat(level) + " ";

    const replacement = prefix + selectedText;
    range.deleteContents();
    range.insertNode(document.createTextNode(replacement));

    saveCurrentNote();
}

function addHeader(level) {
    const prefix = "#".repeat(level) + " ";
    applyMarkdown(prefix, ""); // فرض بر این است که تابع applyMarkdown را داری
}

editor.addEventListener("click", function (e) {
    if (e.target.tagName === "A") {
        window.open(e.target.href, "_blank");
    }
});

editor.addEventListener("click", function (e) {
    if (e.target.tagName === "A") {
        e.preventDefault();
        window.open(e.target.href, "_blank");
    }
});

function getCurrentCodeBlock() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;

    let node = sel.getRangeAt(0).startContainer;

    if (node.nodeType !== 1) {
        node = node.parentElement;
    }

    return node.closest("pre.code-block");
}

function toggleCodeBlock() {

    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const existing = getCurrentCodeBlock();

    // اگر داخل code block هستیم → خروج
    if (existing) {

        const p = document.createElement("p");
        p.innerHTML = "<br>";

        existing.after(p);

        const range = document.createRange();
        range.selectNodeContents(p);
        range.collapse(true);

        sel.removeAllRanges();
        sel.addRange(range);

        return;
    }

    // اگر بیرون هستیم → ساخت code block
    const range = sel.getRangeAt(0);

    const pre = document.createElement("pre");
    pre.className = "code-block";

    const code = document.createElement("code");
    code.appendChild(document.createTextNode(""));

    pre.appendChild(code);

    range.deleteContents();
    range.insertNode(pre);

    // خط بعدی (متن عادی)
    const p = document.createElement("p");
    p.innerHTML = "<br>";
    pre.after(p);

    // قرار دادن کرسر داخل code block
    const newRange = document.createRange();
    newRange.selectNodeContents(code);
    newRange.collapse(true);

    sel.removeAllRanges();
    sel.addRange(newRange);
}

editor.addEventListener("keydown", function (e) {

    if (e.key !== "Enter") return;

    const pre = getCurrentCodeBlock();
    if (!pre) return;

    e.preventDefault();

    const sel = window.getSelection();
    const range = sel.getRangeAt(0);

    const newline = document.createTextNode("\n");

    range.insertNode(newline);

    range.setStartAfter(newline);
    range.collapse(true);

    sel.removeAllRanges();
    sel.addRange(range);
});

// ----------- EXPORT / IMPORT JSON -----------

function exportData() {
    // داده‌هایی که می‌خواهیم ذخیره کنیم
    const data = {
        notes: JSON.parse(localStorage.getItem("notes") || "[]"),
        folders: JSON.parse(localStorage.getItem("folders") || "[]"),
        pinned: JSON.parse(localStorage.getItem("pinned") || "[]"),
        lastOpened: localStorage.getItem("lastOpened") || null
    };

    const json = JSON.stringify(data, null, 2);

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "notes_backup.json";
    a.click();

    URL.revokeObjectURL(url);
    alert("✅ داده‌ها با موفقیت در فایل JSON ذخیره شدند.");
}


function importData() {
    document.getElementById("importFile").click();
}

function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            if (data.notes) localStorage.setItem("notes", JSON.stringify(data.notes));
            if (data.folders) localStorage.setItem("folders", JSON.stringify(data.folders));
            if (data.pinned) localStorage.setItem("pinned", JSON.stringify(data.pinned));
            if (data.lastOpened) localStorage.setItem("lastOpened", data.lastOpened);

            alert("✅ داده‌ها با موفقیت بازیابی شدند!");
            location.reload();

        } catch (err) {
            alert("❌ خطا در خواندن فایل JSON");
            console.error(err);
        }
    };

    reader.readAsText(file);
}

// ----------- DARK MODE -----------

function toggleTheme() {
    const isDark = document.body.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    updateThemeIcon();
}

function loadTheme() {
    const theme = localStorage.getItem("theme");
    if (theme === "dark") {
        document.body.classList.add("dark");
    }
    updateThemeIcon();
}

function updateThemeIcon() {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;
    btn.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
}

// هنگام لود صفحه
loadTheme();

// لود اولیه
renderSidebar();
