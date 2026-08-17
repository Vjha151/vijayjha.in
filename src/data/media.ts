export const profile = {
  src: "", // Add /images/vijay-profile.webp here when ready.
  alt: "Portrait of Vijay Jha",
  eyebrow: "PERSONAL PORTRAIT",
};

export type GalleryItem = { src:string; title:string; caption:string; alt:string };
export const gallery: GalleryItem[] = [
  { src:"", title:"Between destinations", caption:"Travel, perspective and the road ahead.", alt:"Travel memory placeholder" },
  { src:"", title:"The quiet frame", caption:"A personal study in light and observation.", alt:"Photography memory placeholder" },
  { src:"", title:"Off the clock", caption:"Small moments, kept close.", alt:"Personal memory placeholder" },
];
