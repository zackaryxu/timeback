document.querySelectorAll('[data-recognition-deadline]').forEach(node=>{if(new Date().toISOString().slice(0,10)>node.dataset.recognitionDeadline)node.textContent='Upcoming status expired';});
