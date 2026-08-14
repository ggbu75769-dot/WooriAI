import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { Alert } from "react-native";

type ConfirmDiscardChangesOptions = {
  message?: string;
  title?: string;
};

export function useConfirmDiscardChanges(
  enabled: boolean,
  options: ConfirmDiscardChangesOptions = {}
) {
  const navigation = useNavigation();

  usePreventRemove(enabled, ({ data }) => {
    Alert.alert(
      options.title ?? "변경 내용을 저장하지 않았어요",
      options.message ?? "이 화면을 나가면 입력한 내용이 사라집니다.",
      [
        { text: "계속 수정", style: "cancel" },
        {
          text: "저장하지 않고 나가기",
          style: "destructive",
          onPress: () => navigation.dispatch(data.action)
        }
      ]
    );
  });
}
