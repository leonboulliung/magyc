import Image from "next/image";

export function LogoMark() {
  return (
    <span className="grid h-8 w-[92px] place-items-center rounded bg-white px-3">
      <Image
        src="/magyc-marble-2048x2048.png"
        alt="MAGYC"
        width={1130}
        height={312}
        className="h-[18px] w-auto"
      />
    </span>
  );
}
