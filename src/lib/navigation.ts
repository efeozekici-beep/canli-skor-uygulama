// Hash yönlendirmesiyle bir sayfaya git: navigateTo('#/lig/2') veya navigateTo('/lig/2')
export function navigateTo(href: string) {
  window.location.hash = href.startsWith('#') ? href.slice(1) : href
}
