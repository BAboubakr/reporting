// Load the validated report generator after the Atlas app module has initialized.
// Also guard the modal backdrop: it must never appear unless the application
// explicitly adds the .is-open state.
function guardAtlasModal(){
  const modal=document.getElementById('modalBackdrop');
  if(!modal)return;
  if(!modal.classList.contains('is-open')){
    modal.setAttribute('aria-hidden','true');
    modal.style.display='none';
  }else{
    modal.style.display='flex';
  }
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',guardAtlasModal,{once:true});
}else{
  guardAtlasModal();
}
window.addEventListener('load',guardAtlasModal,{once:true});

const s=document.createElement('script');
s.src='report-generator-PATCH%20(2).js?v=20260826-1';
s.async=false;
document.head.appendChild(s);
