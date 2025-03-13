function dropbox(link) {
  if (link.includes("&dl=0")) {
    link = link.replace("&dl=0", "&raw=1");
  }
  if (!link.includes("&dl=1") && !link.includes("&raw=1")) {
    link = link + "&raw=1";
  }
  return { link: link, redirect: true };
}

module.exports = dropbox;
