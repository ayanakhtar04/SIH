// Allow importing image assets directly in TS/TSX
declare module '*.png' {
  const src: string;
  export default src;
}
