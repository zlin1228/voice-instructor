"use client"

import { useInit } from "../../components/utils/global"

export default function Layout(props: { children: React.ReactNode }) {
  useInit()
  return props.children
}
