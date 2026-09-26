(function () {
  const token = localStorage.getItem('wp_token');
  const userRaw = localStorage.getItem('wp_user');
  if (!token || !userRaw) {
    window.location.replace('index.html');
    return;
  }
  const user = JSON.parse(userRaw);

  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PASTE_YOUR')) {
    document.body.innerHTML = `<div style="max-width:520px;margin:15vh auto;padding:2rem;text-align:center;font-family:sans-serif;">
      <h1 style="font-size:1.4rem;">Backend not connected yet</h1>
      <p style="color:#666;margin-top:.75rem;">Deploy <code>google-apps-script/Code.gs</code> as a Web App, then paste its URL into <code>js/config.js</code> as <code>APPS_SCRIPT_URL</code>.</p>
      <a href="index.html" style="color:#4F46E5;">← Back to login</a>
    </div>`;
    throw new Error('APPS_SCRIPT_URL is not configured');
  }

  const EXPENSE_CATEGORIES = [
    { name: 'Food & Dining', icon: '🍔', color: '#4F46E5' },
    { name: 'Shopping', icon: '🛍️', color: '#E23F5D' },
    { name: 'Bills', icon: '🧾', color: '#F5A524' },
    { name: 'Transport', icon: '🚗', color: '#17A65A' },
    { name: 'Entertainment', icon: '🎬', color: '#0EA5A0' },
    { name: 'Healthcare', icon: '⚕️', color: '#F97316' },
    { name: 'Travel', icon: '✈️', color: '#8B5CF6' },
    { name: 'Subscriptions', icon: '🔁', color: '#EC4899' },
    { name: 'Other', icon: '📦', color: '#64748B' },
  ];
  const INCOME_CATEGORIES = [
    { name: 'Salary', icon: '💰', color: '#17A65A' },
    { name: 'Freelance', icon: '💻', color: '#4F46E5' },
    { name: 'Investment', icon: '📊', color: '#0EA5A0' },
    { name: 'Other Income', icon: '➕', color: '#F5A524' },
  ];
  const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

  function categoryMeta(name) {
    return ALL_CATEGORIES.find((c) => c.name === name) || { icon: '📦', color: '#64748B' };
  }

  const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  function fmtMoney(n) {
    return inr.format(Number(n) || 0);
  }
  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  }

  let expenses = [];
  let currentView = 'overview';
  let pendingDeleteId = null;

  // ---------------- Header / greeting ----------------
  document.getElementById('topUserName').textContent = user.name;
  document.getElementById('topAvatar').innerHTML = maleAvatarSVG('happy');

  const hour = new Date().getHours();
  const greetWord = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greeting').textContent = `${greetWord}, ${user.name.split(' ')[0]} 👋`;

  // ---------------- Sidebar / navigation ----------------
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('backdrop');
  const hamburger = document.getElementById('hamburger');

  function openDrawer() {
    sidebar.classList.add('open');
    backdrop.classList.remove('hidden');
  }
  function closeDrawer() {
    sidebar.classList.remove('open');
    backdrop.classList.add('hidden');
  }
  hamburger.addEventListener('click', openDrawer);
  backdrop.addEventListener('click', closeDrawer);

  function setView(view) {
    currentView = view;
    ['overview', 'transactions', 'analytics'].forEach((v) => {
      document.getElementById('view-' + v).classList.toggle('hidden', v !== view);
    });
    document.querySelectorAll('.nav-link').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    if (view === 'analytics') renderAnalyticsCharts();
    closeDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.querySelectorAll('.nav-link').forEach((btn) =>
    btn.addEventListener('click', () => setView(btn.dataset.view))
  );
  document.querySelectorAll('[data-goto]').forEach((btn) =>
    btn.addEventListener('click', () => setView(btn.dataset.goto))
  );

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('wp_token');
    localStorage.removeItem('wp_user');
    window.location.href = 'index.html';
  });

  // ---------------- Toasts ----------------
  function toast(message, type = 'success') {
    const wrap = document.getElementById('toastContainer');
    const el = document.createElement('div');
    const good = type === 'success';
    el.className = 'row-enter card px-4 py-3 flex items-center gap-3 min-w-[240px] max-w-xs';
    el.innerHTML = `
      <span class="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0" style="background:${good ? 'var(--income-soft)' : 'var(--expense-soft)'}">${good ? '✅' : '⚠️'}</span>
      <span class="text-sm" style="color: var(--ink);">${message}</span>`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.classList.add('row-exit');
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  // ---------------- API helpers ----------------
  // Every call goes to the single Apps Script Web App URL. Reads use a plain
  // GET with query params; writes use POST with a text/plain body (so the
  // browser never sends a CORS preflight, which Apps Script can't answer).
  async function api(action, payload = {}) {
    let res;
    if (action === 'list') {
      const url = new URL(APPS_SCRIPT_URL);
      url.searchParams.set('action', 'list');
      url.searchParams.set('token', token);
      res = await fetch(url.toString());
    } else {
      res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token, ...payload }),
      });
    }
    const data = await res.json().catch(() => ({}));
    if (data.success === false && /session expired/i.test(data.message || '')) {
      localStorage.removeItem('wp_token');
      localStorage.removeItem('wp_user');
      window.location.href = 'index.html';
      throw new Error(data.message);
    }
    if (!res.ok || data.success === false) {
      throw new Error(data.message || 'Something went wrong');
    }
    return data;
  }

  async function loadExpenses() {
    try {
      const data = await api('list');
      expenses = data.expenses || [];
      renderAll();
    } catch (err) {
      console.error(err);
      toast(err.message || "Couldn't load your expenses.", 'error');
      expenses = [];
      renderAll();
    }
  }

  // ---------------- Derived data helpers ----------------
  function monthKey(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${d.getMonth()}`;
  }
  function monthLabel(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { month: 'short' });
  }
  function isThisMonth(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  function totals(list) {
    const income = list.filter((e) => e.type === 'Income').reduce((s, e) => s + e.amount, 0);
    const expense = list.filter((e) => e.type === 'Expense').reduce((s, e) => s + e.amount, 0);
    return { income, expense, balance: income - expense };
  }

  // ---------------- Renderers ----------------
  function renderStats() {
    const thisMonth = expenses.filter((e) => isThisMonth(e.date));
    const t = totals(expenses);
    const tm = totals(thisMonth);
    document.getElementById('statBalance').textContent = fmtMoney(t.balance);
    document.getElementById('statIncome').textContent = fmtMoney(tm.income);
    document.getElementById('statExpenses').textContent = fmtMoney(tm.expense);
    document.getElementById('statSavings').textContent = fmtMoney(Math.max(tm.income - tm.expense, 0));

    const rate = tm.income > 0 ? Math.round(((tm.income - tm.expense) / tm.income) * 100) : 0;
    document.getElementById('sidebarSavingsLine').textContent =
      tm.income > 0 ? `You've saved ${rate}% of what you've earned.` : 'Add income to see your saving rate.';
  }

  function renderTrend() {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-IN', { month: 'short' }) });
    }
    const income = months.map((m) => expenses.filter((e) => e.type === 'Income' && monthKey(e.date) === m.key).reduce((s, e) => s + e.amount, 0));
    const expense = months.map((m) => expenses.filter((e) => e.type === 'Expense' && monthKey(e.date) === m.key).reduce((s, e) => s + e.amount, 0));
    WPCharts.renderTrend(months.map((m) => m.label), income, expense);
    return { months, income, expense };
  }

  function renderDistribution() {
    const thisMonth = expenses.filter((e) => e.type === 'Expense' && isThisMonth(e.date));
    const byCat = {};
    thisMonth.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + e.amount));
    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const labels = entries.map((e) => e[0]);
    const data = entries.map((e) => e[1]);
    const colors = labels.map((l) => categoryMeta(l).color);
    WPCharts.renderDoughnut(labels, data, colors);

    const total = data.reduce((a, b) => a + b, 0) || 1;
    const legend = document.getElementById('distributionLegend');
    legend.innerHTML = entries
      .slice(0, 6)
      .map(([name, amount]) => {
        const meta = categoryMeta(name);
        const pct = Math.round((amount / total) * 100);
        return `<div class="flex items-center justify-between">
          <span class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full inline-block" style="background:${meta.color}"></span>${name}</span>
          <span style="color: var(--ink-soft);">${pct}% · ${fmtMoney(amount)}</span>
        </div>`;
      })
      .join('') || `<p class="text-sm" style="color: var(--ink-soft);">No expenses recorded this month yet.</p>`;
    return entries;
  }

  function renderTopCategories(entries) {
    const wrap = document.getElementById('topCategories');
    if (!entries.length) {
      wrap.innerHTML = `<p class="text-sm" style="color: var(--ink-soft);">Add an expense to see your top categories here.</p>`;
      return;
    }
    const max = entries[0][1];
    wrap.innerHTML = entries
      .slice(0, 5)
      .map(([name, amount]) => {
        const meta = categoryMeta(name);
        const pct = Math.round((amount / max) * 100);
        return `<div>
          <div class="flex items-center justify-between text-sm mb-1.5">
            <span class="flex items-center gap-2 font-medium" style="color: var(--ink);">${meta.icon} ${name}</span>
            <span style="color: var(--ink-soft);">${fmtMoney(amount)}</span>
          </div>
          <div class="bar-track h-2"><div class="bar-fill h-2" style="width:${pct}%; background:${meta.color};"></div></div>
        </div>`;
      })
      .join('');
  }

  function renderQuickInsights() {
    const el = document.getElementById('quickInsights');
    if (!expenses.length) {
      el.innerHTML = `<p class="text-sm" style="color: var(--ink-soft);">Insights will appear once you add a few transactions.</p>`;
      return;
    }
    const thisMonthExpenses = expenses.filter((e) => e.type === 'Expense' && isThisMonth(e.date));
    const byCat = {};
    thisMonthExpenses.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + e.amount));
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    const days = new Set(thisMonthExpenses.map((e) => e.date)).size || 1;
    const avgDaily = thisMonthExpenses.reduce((s, e) => s + e.amount, 0) / days;
    const biggest = [...expenses].sort((a, b) => b.amount - a.amount)[0];

    const items = [];
    if (top) {
      items.push({ label: 'Highest spending', value: top[0], sub: fmtMoney(top[1]), icon: categoryMeta(top[0]).icon, bg: 'var(--brand-soft)' });
    }
    items.push({ label: 'Avg. daily spend', value: fmtMoney(Math.round(avgDaily)), sub: 'Based on this month', icon: '📅', bg: 'var(--teal-soft)' });
    if (biggest) {
      items.push({ label: 'Biggest transaction', value: fmtMoney(biggest.amount), sub: `${biggest.category} · ${fmtDate(biggest.date)}`, icon: '⚡', bg: 'var(--warn-soft)' });
    }

    el.innerHTML = items
      .map(
        (i) => `<div class="rounded-2xl p-3.5 flex items-center gap-3" style="background:#FAFAFE; border:1px solid var(--line);">
        <span class="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style="background:${i.bg};">${i.icon}</span>
        <div class="min-w-0">
          <p class="text-xs" style="color: var(--ink-soft);">${i.label}</p>
          <p class="font-display font-semibold text-sm truncate" style="color: var(--ink);">${i.value}</p>
          <p class="text-xs truncate" style="color: var(--ink-soft);">${i.sub}</p>
        </div>
      </div>`
      )
      .join('');
  }

  function actionButtons(id) {
    return `<div class="flex items-center justify-end gap-1.5">
      <button data-edit="${id}" class="btn w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--brand-soft)]" title="Edit">✏️</button>
      <button data-delete="${id}" class="btn w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--expense-soft)]" title="Delete">🗑️</button>
    </div>`;
  }

  function statusPill(status) {
    const isPending = status === 'Pending';
    return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold" style="background:${isPending ? 'var(--warn-soft)' : 'var(--income-soft)'}; color:${isPending ? '#8A5A0A' : 'var(--income)'};">${status}</span>`;
  }

  function renderRecentTable() {
    const body = document.getElementById('recentTableBody');
    const empty = document.getElementById('recentEmpty');
    const recent = [...expenses].slice(0, 8);
    document.getElementById('recentCount').textContent = `Last ${recent.length} of ${expenses.length}`;

    if (!recent.length) {
      body.innerHTML = '';
      empty.classList.remove('hidden');
      empty.innerHTML = emptyStateMarkup();
      bindEmptyStateCta(empty);
      return;
    }
    empty.classList.add('hidden');
    body.innerHTML = recent
      .map((e) => {
        const meta = categoryMeta(e.category);
        const sign = e.type === 'Income' ? '+' : '-';
        const color = e.type === 'Income' ? 'var(--income)' : 'var(--expense)';
        return `<tr class="row-enter border-t" style="border-color: var(--line);" data-row="${e.id}">
          <td class="py-3" style="color: var(--ink-soft);">${fmtDate(e.date)}</td>
          <td class="py-3"><span class="px-2.5 py-1 rounded-full text-xs font-semibold" style="background:${meta.color}1A; color:${meta.color};">${meta.icon} ${e.category}</span></td>
          <td class="py-3" style="color: var(--ink);">${e.description || '—'}</td>
          <td class="py-3 text-right font-semibold" style="color:${color};">${sign}${fmtMoney(e.amount)}</td>
          <td class="py-3">${actionButtons(e.id)}</td>
        </tr>`;
      })
      .join('');
  }

  function emptyStateMarkup() {
    return `<div class="mx-auto w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-3" style="background: var(--brand-soft);">🧾</div>
      <p class="font-display font-semibold" style="color: var(--ink);">No expenses yet</p>
      <p class="text-sm mt-1" style="color: var(--ink-soft);">Add your first transaction to see it appear here and in your Google Sheet.</p>
      <button data-empty-cta class="btn btn-primary mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold text-white">＋ Add expense</button>`;
  }
  function bindEmptyStateCta(container) {
    const btn = container.querySelector('[data-empty-cta]');
    if (btn) btn.addEventListener('click', () => openExpenseModal());
  }

  function currentFilteredAll() {
    const type = document.getElementById('filterType').value;
    const cat = document.getElementById('filterCategory').value;
    const q = document.getElementById('searchInput').value.trim().toLowerCase();
    return expenses.filter((e) => {
      if (type !== 'all' && e.type !== type) return false;
      if (cat !== 'all' && e.category !== cat) return false;
      if (q && !(e.category.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }

  function renderAllTable() {
    const body = document.getElementById('allTableBody');
    const empty = document.getElementById('allEmpty');
    const list = currentFilteredAll();
    document.getElementById('filterCount').textContent = `${list.length} transaction${list.length === 1 ? '' : 's'}`;

    if (!list.length) {
      body.innerHTML = '';
      empty.classList.remove('hidden');
      empty.innerHTML = expenses.length
        ? `<p class="text-sm" style="color: var(--ink-soft);">Nothing matches these filters.</p>`
        : emptyStateMarkup();
      bindEmptyStateCta(empty);
      return;
    }
    empty.classList.add('hidden');
    body.innerHTML = list
      .map((e) => {
        const meta = categoryMeta(e.category);
        const sign = e.type === 'Income' ? '+' : '-';
        const color = e.type === 'Income' ? 'var(--income)' : 'var(--expense)';
        return `<tr class="row-enter border-t" style="border-color: var(--line);" data-row="${e.id}">
          <td class="py-3" style="color: var(--ink-soft);">${fmtDate(e.date)}</td>
          <td class="py-3"><span class="px-2.5 py-1 rounded-full text-xs font-semibold" style="background:${meta.color}1A; color:${meta.color};">${meta.icon} ${e.category}</span></td>
          <td class="py-3" style="color: var(--ink);">${e.description || '—'}</td>
          <td class="py-3" style="color: var(--ink-soft);">${e.paymentMethod || '—'}</td>
          <td class="py-3">${statusPill(e.status)}</td>
          <td class="py-3 text-right font-semibold" style="color:${color};">${sign}${fmtMoney(e.amount)}</td>
          <td class="py-3">${actionButtons(e.id)}</td>
        </tr>`;
      })
      .join('');
  }

  function populateCategoryFilter() {
    const select = document.getElementById('filterCategory');
    const used = [...new Set(expenses.map((e) => e.category))];
    select.innerHTML =
      '<option value="all">All categories</option>' +
      used.map((c) => `<option value="${c}">${c}</option>`).join('');
  }

  function renderAnalyticsCharts() {
    const now = new Date();
    const day = now.getDay(); // 0 Sun - 6 Sat
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const weekLabels = [];
    const weekData = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekLabels.push(d.toLocaleDateString('en-IN', { weekday: 'short' }));
      const dayTotal = expenses
        .filter((e) => e.type === 'Expense' && sameDay(new Date(e.date), d))
        .reduce((s, e) => s + e.amount, 0);
      weekData.push(dayTotal);
    }
    WPCharts.renderWeekly(weekLabels, weekData);

    const { months, income, expense } = renderTrend();
    WPCharts.renderComparison(months.map((m) => m.label), income, expense);

    const thisMonth = expenses.filter((e) => e.type === 'Expense' && isThisMonth(e.date));
    const byCat = {};
    thisMonth.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + e.amount));
    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    WPCharts.renderCategoryBar(
      entries.map((e) => e[0]),
      entries.map((e) => e[1]),
      entries.map((e) => categoryMeta(e[0]).color)
    );
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function renderAll() {
    renderStats();
    const entries = renderDistribution();
    renderTopCategories(entries);
    renderQuickInsights();
    renderRecentTable();
    renderTrend();
    populateCategoryFilter();
    renderAllTable();
    if (currentView === 'analytics') renderAnalyticsCharts();
  }

  // ---------------- Search & filters ----------------
  document.getElementById('searchInput').addEventListener('input', () => {
    if (currentView !== 'transactions') setView('transactions');
    renderAllTable();
  });
  document.getElementById('filterType').addEventListener('change', renderAllTable);
  document.getElementById('filterCategory').addEventListener('change', renderAllTable);

  // ---------------- Expense modal ----------------
  const expenseModal = document.getElementById('expenseModalOverlay');
  const expenseForm = document.getElementById('expenseForm');
  const typeButtons = document.querySelectorAll('.type-btn');
  let activeType = 'Expense';

  function styleTypeButtons() {
    typeButtons.forEach((btn) => {
      const active = btn.dataset.type === activeType;
      const isExpense = btn.dataset.type === 'Expense';
      btn.style.background = active ? (isExpense ? 'var(--expense)' : 'var(--income)') : 'transparent';
      btn.style.color = active ? '#fff' : 'var(--ink-soft)';
    });
  }
  function populateCategorySelect() {
    const select = document.getElementById('expCategory');
    const list = activeType === 'Expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    select.innerHTML = list.map((c) => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('');
  }
  typeButtons.forEach((btn) =>
    btn.addEventListener('click', () => {
      activeType = btn.dataset.type;
      styleTypeButtons();
      populateCategorySelect();
    })
  );

  function openExpenseModal(expense = null) {
    expenseForm.reset();
    document.getElementById('expenseId').value = expense ? expense.id : '';
    activeType = expense ? expense.type : 'Expense';
    styleTypeButtons();
    populateCategorySelect();

    document.getElementById('expenseModalTitle').textContent = expense ? 'Edit expense' : 'Add expense';
    document.getElementById('saveExpenseLabel').textContent = expense ? 'Update expense' : 'Save expense';

    document.getElementById('expDate').value = expense ? expense.date : new Date().toISOString().slice(0, 10);
    document.getElementById('expAmount').value = expense ? expense.amount : '';
    document.getElementById('expCategory').value = expense ? expense.category : '';
    document.getElementById('expDescription').value = expense ? expense.description : '';
    document.getElementById('expPayment').value = expense ? expense.paymentMethod : 'UPI';
    document.getElementById('expStatus').value = expense ? expense.status : 'Completed';

    expenseModal.classList.remove('hidden');
    expenseModal.classList.add('flex');
  }
  function closeExpenseModal() {
    expenseModal.classList.add('hidden');
    expenseModal.classList.remove('flex');
  }

  document.getElementById('addExpenseBtn').addEventListener('click', () => openExpenseModal());
  document.getElementById('addExpenseBtnMobile').addEventListener('click', () => openExpenseModal());
  document.getElementById('closeExpenseModal').addEventListener('click', closeExpenseModal);
  document.getElementById('cancelExpenseBtn').addEventListener('click', closeExpenseModal);
  expenseModal.addEventListener('click', (e) => {
    if (e.target === expenseModal) closeExpenseModal();
  });

  expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('expenseId').value;
    const amount = parseFloat(document.getElementById('expAmount').value);
    const date = document.getElementById('expDate').value;
    const category = document.getElementById('expCategory').value;

    if (!date || !category || !amount || amount <= 0) {
      toast('Please fill in date, category and a valid amount.', 'error');
      return;
    }

    const payload = {
      date,
      category,
      description: document.getElementById('expDescription').value.trim(),
      paymentMethod: document.getElementById('expPayment').value,
      amount,
      type: activeType,
      status: document.getElementById('expStatus').value,
    };

    const saveBtn = document.getElementById('saveExpenseBtn');
    const label = document.getElementById('saveExpenseLabel');
    const loader = document.getElementById('saveExpenseLoader');
    saveBtn.disabled = true;
    label.classList.add('hidden');
    loader.classList.remove('hidden');
    loader.classList.add('flex');

    try {
      if (id) {
        const data = await api('update', { id, ...payload });
        expenses = expenses.map((ex) => (ex.id === id ? data.expense : ex));
        toast('Expense updated.');
      } else {
        const data = await api('add', payload);
        expenses = [data.expense, ...expenses];
        toast('Expense added.');
      }
      closeExpenseModal();
      renderAll();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Could not save this expense.', 'error');
    } finally {
      saveBtn.disabled = false;
      label.classList.remove('hidden');
      loader.classList.add('hidden');
      loader.classList.remove('flex');
    }
  });

  // ---------------- Edit / delete delegation ----------------
  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) {
      const expense = expenses.find((x) => x.id === editBtn.dataset.edit);
      if (expense) openExpenseModal(expense);
      return;
    }
    const delBtn = e.target.closest('[data-delete]');
    if (delBtn) {
      pendingDeleteId = delBtn.dataset.delete;
      document.getElementById('deleteModalOverlay').classList.remove('hidden');
      document.getElementById('deleteModalOverlay').classList.add('flex');
    }
  });

  const deleteModal = document.getElementById('deleteModalOverlay');
  document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
    pendingDeleteId = null;
    deleteModal.classList.add('hidden');
    deleteModal.classList.remove('flex');
  });
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
      deleteModal.classList.add('hidden');
      deleteModal.classList.remove('flex');
    }
  });
  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    document.querySelectorAll(`[data-row="${id}"]`).forEach((row) => row.classList.add('row-exit'));
    deleteModal.classList.add('hidden');
    deleteModal.classList.remove('flex');

    try {
      await api('delete', { id });
      expenses = expenses.filter((x) => x.id !== id);
      toast('Expense deleted.');
      setTimeout(renderAll, 220);
    } catch (err) {
      console.error(err);
      toast(err.message || 'Could not delete this expense.', 'error');
      renderAll();
    }
    pendingDeleteId = null;
  });

  // ---------------- Ripple feedback (shared with login page) ----------------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.width = span.style.height = size + 'px';
    span.style.left = e.clientX - rect.left - size / 2 + 'px';
    span.style.top = e.clientY - rect.top - size / 2 + 'px';
    btn.appendChild(span);
    setTimeout(() => span.remove(), 650);
  });

  // ---------------- Init ----------------
  loadExpenses();
})();
