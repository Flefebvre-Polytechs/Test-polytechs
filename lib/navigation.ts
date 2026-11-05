export function serviceHref(path:string,teamId:string){const url=new URL(path,'https://polytechs.invalid');if(teamId)url.searchParams.set('team',teamId);else url.searchParams.delete('team');return url.pathname+url.search+url.hash}

// The GED service context travels in the URL, including for links from the sidebar.
export function gedHref(teamId:string,global=false){const params=new URLSearchParams(global?{scope:'global'}:{scope:'service',team:teamId});return '/ged?'+params.toString()}
