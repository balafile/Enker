(function () {
  window.WPCharts = {};
  const instances = {};

  const FONT = "'Inter', sans-serif";

  function destroy(id) {
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
  }

  function ctx(id) {
    const el = document.getElementById(id);
    return el ? el.getContext('2d') : null;
  }

  window.WPCharts.renderTrend = function (labels, income, expense) {
    destroy('trendChart');
    const c = ctx('trendChart');
    if (!c) return;
    instances.trendChart = new Chart(c, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Income',
            data: income,
            borderColor: '#4F46E5',
            backgroundColor: 'rgba(79,70,229,0.08)',
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointBackgroundColor: '#4F46E5',
            borderWidth: 2.5,
          },
          {
            label: 'Expenses',
            data: expense,
            borderColor: '#E23F5D',
            backgroundColor: 'rgba(226,63,93,0.06)',
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointBackgroundColor: '#E23F5D',
            borderWidth: 2.5,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: FONT, size: 11 }, color: '#8A8DAB' } },
          y: {
            grid: { color: '#EEEFF8' },
            ticks: {
              font: { family: FONT, size: 11 },
              color: '#8A8DAB',
              callback: (v) => '₹' + (v >= 1000 ? v / 1000 + 'k' : v),
            },
          },
        },
      },
    });
  };

  window.WPCharts.renderDoughnut = function (labels, data, colors) {
    destroy('distributionChart');
    const c = ctx('distributionChart');
    if (!c) return;
    instances.distributionChart = new Chart(c, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 3, borderColor: '#fff' }] },
      options: {
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { display: false } },
      },
    });
  };

  window.WPCharts.renderWeekly = function (labels, data) {
    destroy('weeklyChart');
    const c = ctx('weeklyChart');
    if (!c) return;
    instances.weeklyChart = new Chart(c, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data, backgroundColor: '#4F46E5', borderRadius: 8, maxBarThickness: 34 }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: FONT, size: 11 }, color: '#8A8DAB' } },
          y: {
            grid: { color: '#EEEFF8' },
            ticks: { font: { family: FONT, size: 11 }, color: '#8A8DAB', callback: (v) => '₹' + v },
          },
        },
      },
    });
  };

  window.WPCharts.renderComparison = function (labels, income, expense) {
    destroy('comparisonChart');
    const c = ctx('comparisonChart');
    if (!c) return;
    instances.comparisonChart = new Chart(c, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Income', data: income, backgroundColor: '#4F46E5', borderRadius: 6, maxBarThickness: 26 },
          { label: 'Expenses', data: expense, backgroundColor: '#F4A8B7', borderRadius: 6, maxBarThickness: 26 },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family: FONT, size: 12 }, color: '#5B5E7A', usePointStyle: true } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: FONT, size: 11 }, color: '#8A8DAB' } },
          y: { grid: { color: '#EEEFF8' }, ticks: { font: { family: FONT, size: 11 }, color: '#8A8DAB', callback: (v) => '₹' + (v >= 1000 ? v / 1000 + 'k' : v) } },
        },
      },
    });
  };

  window.WPCharts.renderCategoryBar = function (labels, data, colors) {
    destroy('categoryBarChart');
    const c = ctx('categoryBarChart');
    if (!c) return;
    instances.categoryBarChart = new Chart(c, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 8, maxBarThickness: 26 }] },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#EEEFF8' }, ticks: { font: { family: FONT, size: 11 }, color: '#8A8DAB', callback: (v) => '₹' + v } },
          y: { grid: { display: false }, ticks: { font: { family: FONT, size: 11 }, color: '#5B5E7A' } },
        },
      },
    });
  };
})();
