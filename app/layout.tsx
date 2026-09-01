import type {Metadata} from "next";import "./globals.css";import "./visual-lesson.css";
export const metadata:Metadata={title:"S2S Studio — Something to show",description:"Turn any idea into a presentation worth showing."};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
