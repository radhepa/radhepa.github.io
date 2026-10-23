// Filter chips on the Projects and Lab notebook pages.
// Without JavaScript every item stays visible, so the pages still work.
document.querySelectorAll('[data-filter-group]').forEach(function (group) {
  var list = document.getElementById(group.getAttribute('data-filter-group'));
  var counter = document.querySelector('[data-count-for="' + list.id + '"]');
  var items = list.querySelectorAll('[data-cat]');
  var chips = group.querySelectorAll('[data-filter]');

  function apply(key) {
    var shown = 0;
    items.forEach(function (el) {
      var on = key === 'all' || el.getAttribute('data-cat') === key;
      el.hidden = !on;
      if (on) shown++;
    });
    chips.forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.getAttribute('data-filter') === key));
    });
    if (counter) counter.textContent = counter.getAttribute('data-template')
      .replace('{n}', shown).replace('{total}', items.length);
    if (history.replaceState) {
      history.replaceState(null, '', key === 'all' ? location.pathname : '#' + key);
    }
  }

  chips.forEach(function (c) {
    c.addEventListener('click', function () { apply(c.getAttribute('data-filter')); });
  });

  var start = location.hash.slice(1);
  if (start && group.querySelector('[data-filter="' + start + '"]')) apply(start);
});
