
document.addEventListener('DOMContentLoaded', function() {
  // Add interactivity to the dashboard
  
  // Toggle API details
  const apiRows = document.querySelectorAll('.api-table tbody tr');
  apiRows.forEach(row => {
    row.addEventListener('click', function(e) {
      // Don't toggle if clicking on a button
      if (e.target.tagName === 'A') return;
      
      this.classList.toggle('expanded');
    });
  });
  
  // Refresh button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      location.reload();
    });
  }
  
  // Filter APIs
  const filterInput = document.getElementById('filter-apis');
  if (filterInput) {
    filterInput.addEventListener('input', function() {
      const filterValue = this.value.toLowerCase();
      
      apiRows.forEach(row => {
        const apiName = row.querySelector('td:first-child').textContent.toLowerCase();
        const apiType = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
        
        if (apiName.includes(filterValue) || apiType.includes(filterValue)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
  }
});
    