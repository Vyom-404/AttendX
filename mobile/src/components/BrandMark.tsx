import { StyleSheet, View } from 'react-native';

/** AttendX doorway and checkmark symbol, sized for the app header or sign-in hero. */
export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.31 }]}>
      <View style={[
        styles.door,
        {
          width: size * 0.48,
          height: size * 0.57,
          left: size * 0.24,
          top: size * 0.18,
          borderTopLeftRadius: size * 0.3,
          borderTopRightRadius: size * 0.3,
          borderWidth: Math.max(2, size * 0.065),
          borderBottomWidth: 0,
        },
      ]} />
      <View style={[styles.tickShort, { width: size * 0.2, height: size * 0.075, left: size * 0.32, top: size * 0.59 }]} />
      <View style={[styles.tickLong, { width: size * 0.34, height: size * 0.075, left: size * 0.43, top: size * 0.53 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { backgroundColor: '#2B1D36', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  door: { position: 'absolute', borderColor: '#FFF8EF' },
  tickShort: { position: 'absolute', backgroundColor: '#FF795F', borderRadius: 20, transform: [{ rotate: '45deg' }] },
  tickLong: { position: 'absolute', backgroundColor: '#FF795F', borderRadius: 20, transform: [{ rotate: '-48deg' }] },
});
