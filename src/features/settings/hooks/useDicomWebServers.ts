import { useQuery } from "@tanstack/react-query";
import { dicomWebServersApi } from "@/api/dicomWebServers";

export function useDicomWebServers() {
  return useQuery({
    queryKey: ["dicom-web-servers"],
    queryFn: () => dicomWebServersApi.list(),
  });
}
