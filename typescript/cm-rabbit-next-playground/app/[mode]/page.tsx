"use client"

import App from "../../components/os2/App"

export default function Home(props: { params: { mode: string } }) {
  return <App mode={props.params.mode} />
}
